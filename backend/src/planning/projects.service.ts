import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { validateScope } from '@oeportal/shared';
import type { Project as ProjectShape } from '@oeportal/shared';
import type { Prisma } from '../generated/prisma/client';
import {
  PlanItemsService,
  PLAN_ITEM_OWNER,
} from '../common/plan-items.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly planItems: PlanItemsService,
  ) {}

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
                language: true,
                scheduleRows: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // One batched query per field instead of one per project - this DB is remote, so avoiding
    // an objectives/scope round trip per project matters once there are more than a handful.
    const projectIds = allPlans.map((p) => p.id);
    const [objectivesById, scopeById] = await Promise.all([
      this.planItems.readMany(
        PLAN_ITEM_OWNER.PROJECT_OBJECTIVE.type,
        projectIds,
      ),
      this.planItems.readMany(PLAN_ITEM_OWNER.PROJECT_SCOPE.type, projectIds),
    ]);

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

      // The single most-recently-created linked OE Plan drives everything about "this
      // project's current state" - its own status, who closed it (if closed), and which
      // Findings Report (if any) governs the Pending/Completed derivation below. Matches the
      // existing individualPlanStatus precedent: always the newest plan, never an aggregate
      // across all of them.
      const mostRecentPlan = [...(p.oePlans || [])].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      )[0];

      // Among that plan's execution schedules, the most-recently-created "finding" language
      // one is its OE Findings Report. Pending kicks in the moment it's released; Completed
      // once every row in it has a correctiveFinalUser (the same condition the Findings page
      // itself uses for its own row/header Completed counts).
      const mostRecentFindingsReport = [...(mostRecentPlan?.executionSchedules || [])]
        .filter((e) => e.language === 'finding')
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

      let findingsCompletedCount: number | undefined;
      let findingsTotalCount: number | undefined;
      if (mostRecentFindingsReport?.status === 'RELEASED') {
        try {
          const rows: Array<{ correctiveFinalUser?: string }> = JSON.parse(
            mostRecentFindingsReport.scheduleRows || '[]',
          );
          findingsTotalCount = rows.length;
          findingsCompletedCount = rows.filter(
            (r) => !!r.correctiveFinalUser,
          ).length;
        } catch {
          // Malformed scheduleRows - treat as "no data" rather than crash the whole list.
        }
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
        objectives: objectivesById.get(p.id) ?? '[]',
        scope: scopeById.get(p.id) ?? '[]',
        version: currentVersion,
        nextVersion,
        processedCount,
        isProcessed,
        isApproved,
        isUsed: (p.oePlans || []).length > 0,
        individualPlanStatus:
          mostRecentPlan?.status as ProjectShape['individualPlanStatus'],
        closedByName: mostRecentPlan?.closedByName,
        closedDate: mostRecentPlan?.closedDate,
        findingsReportStatus: mostRecentFindingsReport?.status,
        findingsCompletedCount,
        findingsTotalCount,
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
    const scopeError = validateScope(scope);
    if (scopeError) {
      throw new BadRequestException(scopeError);
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
      },
    });
    await Promise.all([
      this.planItems.writeList(
        PLAN_ITEM_OWNER.PROJECT_OBJECTIVE.type,
        p.id,
        objectives,
        PLAN_ITEM_OWNER.PROJECT_OBJECTIVE.prefix,
      ),
      this.planItems.writeList(
        PLAN_ITEM_OWNER.PROJECT_SCOPE.type,
        p.id,
        scope,
        PLAN_ITEM_OWNER.PROJECT_SCOPE.prefix,
      ),
    ]);

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
      // The record we just wrote, not a re-read - avoids an extra query in this rarely-hit
      // fallback (getEnrichedProjects not finding its own just-created row).
      objectives,
      scope,
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
    const scopeError = validateScope(scope);
    if (scopeError) {
      throw new BadRequestException(scopeError);
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
      },
    });
    await Promise.all([
      this.planItems.writeList(
        PLAN_ITEM_OWNER.PROJECT_OBJECTIVE.type,
        p.id,
        objectives,
        PLAN_ITEM_OWNER.PROJECT_OBJECTIVE.prefix,
      ),
      this.planItems.writeList(
        PLAN_ITEM_OWNER.PROJECT_SCOPE.type,
        p.id,
        scope,
        PLAN_ITEM_OWNER.PROJECT_SCOPE.prefix,
      ),
    ]);

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
      // The record we just wrote, not a re-read - avoids an extra query in this rarely-hit
      // fallback (getEnrichedProjects not finding its own just-updated row).
      objectives,
      scope,
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
      where: { projectId: id, isDeleted: false },
    });
    if (inUse) {
      throw new ConflictException(
        'This Project is already in use by an Individual OE Plan and cannot be deleted.',
      );
    }
    // Unlike OePlan/ExecutionSchedule, a Project genuinely hard-deletes here (nothing of audit
    // value exists on one until an OePlan is created from it, which the guard above already
    // rules out) - so, unlike those two, its PlanItem rows need explicit cleanup: there's no
    // DB-level cascade possible on PlanItem's polymorphic ownerId.
    await this.planItems.deleteAllForOwner(
      [
        PLAN_ITEM_OWNER.PROJECT_OBJECTIVE.type,
        PLAN_ITEM_OWNER.PROJECT_SCOPE.type,
      ],
      id,
    );
    await this.prisma.project.delete({ where: { id } });
    return true;
  }
}
