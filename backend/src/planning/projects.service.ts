import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hasPlanItemContent } from '@oeportal/shared';
import type { Project as ProjectShape } from '@oeportal/shared';
import type { Prisma } from '../generated/prisma/client';

const SCOPE_REQUIRED_MESSAGE =
  'Scope is required: add at least one scope item before saving the Project.';

/**
 * Shape returned by getEnrichedProjects in the original dbService (typed `any[]` there).
 * Adds the two computed fields the shared Project type doesn't carry.
 */
export interface EnrichedProject extends ProjectShape {
  processedCount: number;
  totalSchedules: number;
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mirrors dbService.getEnrichedPlannedEngagements. Computes, for every OE plan:
   *  - a locked version number (based on occurrence order among APPROVED annual plans' topics)
   *    or a preview version number (for DRAFT annual plans), and
   *  - how many of its linked execution schedules (across all its OE plans) are
   *    RELEASED/APPROVED for a matching department.
   * Used internally by findAll, findByAnnualPlan, create, and update.
   */
  private async getEnrichedProjects(
    annualPlanIdFilter?: string,
    visibleTo: Prisma.ProjectWhereInput = {},
  ): Promise<EnrichedProject[]> {
    const allPlans = await this.prisma.project.findMany({
      include: {
        annualPlan: true,
        oePlans: {
          include: {
            executionSchedules: {
              select: {
                id: true,
                status: true,
                departments: true,
                visitNumber: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Pass 1: Count total approved occurrences per department/topic
    const approvedDeptCounts: Record<string, number> = {};
    for (const p of allPlans) {
      if (p.annualPlan?.status === 'APPROVED') {
        const deptKey = p.departmentId ?? (p.topic || '').trim().toLowerCase();
        approvedDeptCounts[deptKey] = (approvedDeptCounts[deptKey] || 0) + 1;
      }
    }

    // Pass 2: Assign locked versions to approved plans, and preview versions to draft plans
    const runningApprovedOccurrence: Record<string, number> = {};
    const runningDraftOccurrence: Record<string, number> = {};

    const enriched: EnrichedProject[] = allPlans.map((p) => {
      const deptKey = p.departmentId ?? (p.topic || '').trim().toLowerCase();
      const isApproved = p.annualPlan?.status === 'APPROVED';

      let processedCount = 0;
      let totalSchedules = 0;

      for (const proj of p.oePlans || []) {
        for (const sched of proj.executionSchedules || []) {
          totalSchedules++;
          const schedDepts = (sched.departments || '').toLowerCase();
          const matchesDept =
            !deptKey ||
            schedDepts.includes(deptKey) ||
            deptKey.includes(schedDepts);
          if (
            matchesDept &&
            (sched.status === 'RELEASED' || sched.status === 'APPROVED')
          ) {
            processedCount++;
          }
        }
      }

      let versionNum: number;
      if (isApproved) {
        const occurrence = (runningApprovedOccurrence[deptKey] || 0) + 1;
        runningApprovedOccurrence[deptKey] = occurrence;
        versionNum = Math.max(
          occurrence,
          processedCount > 0 ? processedCount + 1 : occurrence,
        );
      } else {
        const draftKey = `${p.annualPlanId}_${deptKey}`;
        const draftOccurrence = (runningDraftOccurrence[draftKey] || 0) + 1;
        runningDraftOccurrence[draftKey] = draftOccurrence;
        const baseApproved = approvedDeptCounts[deptKey] || 0;
        versionNum = Math.max(
          baseApproved + draftOccurrence,
          processedCount > 0
            ? processedCount + 1
            : baseApproved + draftOccurrence,
        );
      }

      const currentVersion = `V${versionNum}`;
      const nextVersion = `V${versionNum + 1}`;
      const isProcessed = processedCount > 0;

      return {
        id: p.id,
        annualPlanId: p.annualPlanId,
        no: p.no,
        projectName: p.projectName,
        departmentId: p.departmentId,
        topic: p.topic,
        bu: p.bu,
        type: p.type,
        revieweeIds: p.revieweeIds,
        conductDate: p.conductDate.toISOString().split('T')[0],
        endDate: p.endDate.toISOString().split('T')[0],
        durationDay: p.durationDay,
        purpose: p.purpose,
        objectives: p.objectives,
        scope: p.scope,
        version: currentVersion,
        nextVersion,
        processedCount,
        isProcessed,
        isApproved,
        isUsed: (p.oePlans || []).length > 0,
        individualPlanStatus: [...(p.oePlans || [])].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        )[0]?.status as ProjectShape['individualPlanStatus'],
        annualPlanStatus: p.annualPlan?.status || 'DRAFT',
        totalSchedules,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      };
    });

    // Version numbers above are counted across EVERY project so they never depend on who is
    // looking; only the rows returned are narrowed to the viewer's scope.
    const visibleIds =
      Object.keys(visibleTo).length > 0
        ? new Set(
            (
              await this.prisma.project.findMany({
                where: visibleTo,
                select: { id: true },
              })
            ).map((r) => r.id),
          )
        : null;

    const filtered = enriched.filter(
      (p) =>
        (!annualPlanIdFilter || p.annualPlanId === annualPlanIdFilter) &&
        (!visibleIds || visibleIds.has(p.id)),
    );

    return filtered.reverse();
  }

  /**
   * A project belongs to exactly one department, and a department to a Business Unit.
   * topic/bu are stored as display text, always derived here from the department so
   * they can never disagree with departmentId.
   */
  private async resolveDepartment(
    departmentId: string,
  ): Promise<{ topic: string; bu: string }> {
    const dept = await this.prisma.department.findUnique({
      where: { id: departmentId },
      include: { businessUnit: true },
    });
    if (!dept) throw new BadRequestException('Department not found');
    if (!dept.businessUnit) {
      throw new BadRequestException(
        'This department has no Business Unit yet. Assign one on the Departments page first.',
      );
    }
    return { topic: dept.name, bu: dept.businessUnit.name };
  }

  /** `visibleTo` is the caller's view scope (see AccessScopeService). */
  async findAll(
    visibleTo: Prisma.ProjectWhereInput = {},
  ): Promise<EnrichedProject[]> {
    return this.getEnrichedProjects(undefined, visibleTo);
  }

  async findByAnnualPlan(
    annualPlanId: string,
    visibleTo: Prisma.ProjectWhereInput = {},
  ): Promise<EnrichedProject[]> {
    return this.getEnrichedProjects(annualPlanId, visibleTo);
  }

  async create(
    annualPlanId: string,
    no: string,
    projectName: string,
    departmentId: string,
    type: string = 'OE',
    revieweeIds: string,
    conductDate: Date,
    endDate: Date,
    durationDay: number,
    purpose: string,
    objectives: string = '',
    scope: string = '',
  ): Promise<EnrichedProject> {
    if (!hasPlanItemContent(scope)) {
      throw new BadRequestException(SCOPE_REQUIRED_MESSAGE);
    }
    const { topic, bu } = await this.resolveDepartment(departmentId);
    const p = await this.prisma.project.create({
      data: {
        annualPlanId,
        no,
        projectName,
        departmentId,
        topic,
        bu,
        type,
        revieweeIds,
        conductDate,
        endDate,
        durationDay,
        purpose,
        objectives,
        scope,
      },
    });

    const allPlans = await this.getEnrichedProjects(annualPlanId);
    const createdPlan = allPlans.find((plan) => plan.id === p.id);
    if (createdPlan) {
      return createdPlan;
    }

    return {
      id: p.id,
      annualPlanId: p.annualPlanId,
      no: p.no,
      projectName: p.projectName,
      departmentId: p.departmentId,
      topic: p.topic,
      bu: p.bu,
      type: p.type,
      revieweeIds: p.revieweeIds,
      conductDate: p.conductDate.toISOString().split('T')[0],
      endDate: p.endDate.toISOString().split('T')[0],
      durationDay: p.durationDay,
      purpose: p.purpose,
      objectives: p.objectives,
      scope: p.scope,
      version: 'V1',
      nextVersion: 'V1',
      processedCount: 0,
      isProcessed: false,
      totalSchedules: 0,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  async update(
    id: string,
    projectName: string,
    departmentId: string,
    type: string,
    revieweeIds: string,
    conductDate: Date,
    endDate: Date,
    durationDay: number,
    purpose: string,
    objectives: string = '',
    scope: string = '',
  ): Promise<EnrichedProject> {
    if (!hasPlanItemContent(scope)) {
      throw new BadRequestException(SCOPE_REQUIRED_MESSAGE);
    }
    const { topic, bu } = await this.resolveDepartment(departmentId);
    const p = await this.prisma.project.update({
      where: { id },
      data: {
        projectName,
        departmentId,
        topic,
        bu,
        type,
        revieweeIds,
        conductDate,
        endDate,
        durationDay,
        purpose,
        objectives,
        scope,
      },
    });

    const allPlans = await this.getEnrichedProjects(p.annualPlanId);
    const updatedPlan = allPlans.find((plan) => plan.id === p.id);
    if (updatedPlan) {
      return updatedPlan;
    }

    return {
      id: p.id,
      annualPlanId: p.annualPlanId,
      no: p.no,
      projectName: p.projectName,
      departmentId: p.departmentId,
      topic: p.topic,
      bu: p.bu,
      type: p.type,
      revieweeIds: p.revieweeIds,
      conductDate: p.conductDate.toISOString().split('T')[0],
      endDate: p.endDate.toISOString().split('T')[0],
      durationDay: p.durationDay,
      purpose: p.purpose,
      objectives: p.objectives,
      scope: p.scope,
      version: 'V1',
      nextVersion: 'V1',
      processedCount: 0,
      isProcessed: false,
      totalSchedules: 0,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  async remove(id: string): Promise<boolean> {
    const inUse = await this.prisma.oePlan.findFirst({
      where: { projectId: id },
    });
    if (inUse) {
      throw new ConflictException(
        'This Project is already in use by an Individual OE Plan and cannot be deleted.',
      );
    }
    await this.prisma.project.delete({ where: { id } });
    return true;
  }
}
