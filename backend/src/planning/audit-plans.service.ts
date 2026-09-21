import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hasPlanItemContent } from '@auditdesk/shared';
import type { AuditPlan } from '@auditdesk/shared';

const SCOPE_REQUIRED_MESSAGE =
  'Scope is required: add at least one scope item before saving the Planned Engagement.';

/**
 * Shape returned by getEnrichedAuditPlans in the original dbService (typed `any[]` there).
 * Adds the two computed fields the shared AuditPlan type doesn't carry.
 */
export interface EnrichedAuditPlan extends AuditPlan {
  processedCount: number;
  totalSchedules: number;
}

@Injectable()
export class AuditPlansService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mirrors dbService.getEnrichedAuditPlans. Computes, for every audit plan:
   *  - a locked version number (based on occurrence order among APPROVED annual plans' topics)
   *    or a preview version number (for DRAFT annual plans), and
   *  - how many of its linked execution schedules (across all its audit projects) are
   *    RELEASED/APPROVED for a matching department.
   * Used internally by findAll, findByAnnualPlan, create, and update.
   */
  private async getEnrichedAuditPlans(
    annualPlanIdFilter?: string,
  ): Promise<EnrichedAuditPlan[]> {
    const allPlans = await this.prisma.auditPlan.findMany({
      include: {
        annualPlan: true,
        auditProjects: {
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
        const deptKey = (p.topic || '').trim().toLowerCase();
        approvedDeptCounts[deptKey] = (approvedDeptCounts[deptKey] || 0) + 1;
      }
    }

    // Pass 2: Assign locked versions to approved plans, and preview versions to draft plans
    const runningApprovedOccurrence: Record<string, number> = {};
    const runningDraftOccurrence: Record<string, number> = {};

    const enriched: EnrichedAuditPlan[] = allPlans.map((p) => {
      const deptKey = (p.topic || '').trim().toLowerCase();
      const isApproved = p.annualPlan?.status === 'APPROVED';

      let processedCount = 0;
      let totalSchedules = 0;

      for (const proj of p.auditProjects || []) {
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
        isUsed: (p.auditProjects || []).length > 0,
        individualPlanStatus: [...(p.auditProjects || [])].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        )[0]?.status as AuditPlan['individualPlanStatus'],
        annualPlanStatus: p.annualPlan?.status || 'DRAFT',
        totalSchedules,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      };
    });

    const filtered = annualPlanIdFilter
      ? enriched.filter((p) => p.annualPlanId === annualPlanIdFilter)
      : enriched;

    return filtered.reverse();
  }

  async findAll(): Promise<EnrichedAuditPlan[]> {
    return this.getEnrichedAuditPlans();
  }

  async findByAnnualPlan(annualPlanId: string): Promise<EnrichedAuditPlan[]> {
    return this.getEnrichedAuditPlans(annualPlanId);
  }

  async create(
    annualPlanId: string,
    no: string,
    projectName: string,
    topic: string,
    bu: string,
    type: string = 'OE',
    revieweeIds: string,
    conductDate: Date,
    endDate: Date,
    durationDay: number,
    purpose: string,
    objectives: string = '',
    scope: string = '',
  ): Promise<EnrichedAuditPlan> {
    if (!hasPlanItemContent(scope)) {
      throw new BadRequestException(SCOPE_REQUIRED_MESSAGE);
    }
    const p = await this.prisma.auditPlan.create({
      data: {
        annualPlanId,
        no,
        projectName,
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

    const allPlans = await this.getEnrichedAuditPlans(annualPlanId);
    const createdPlan = allPlans.find((plan) => plan.id === p.id);
    if (createdPlan) {
      return createdPlan;
    }

    return {
      id: p.id,
      annualPlanId: p.annualPlanId,
      no: p.no,
      projectName: p.projectName,
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
    topic: string,
    bu: string,
    type: string,
    revieweeIds: string,
    conductDate: Date,
    endDate: Date,
    durationDay: number,
    purpose: string,
    objectives: string = '',
    scope: string = '',
  ): Promise<EnrichedAuditPlan> {
    if (!hasPlanItemContent(scope)) {
      throw new BadRequestException(SCOPE_REQUIRED_MESSAGE);
    }
    const p = await this.prisma.auditPlan.update({
      where: { id },
      data: {
        projectName,
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

    const allPlans = await this.getEnrichedAuditPlans(p.annualPlanId);
    const updatedPlan = allPlans.find((plan) => plan.id === p.id);
    if (updatedPlan) {
      return updatedPlan;
    }

    return {
      id: p.id,
      annualPlanId: p.annualPlanId,
      no: p.no,
      projectName: p.projectName,
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
    const inUse = await this.prisma.auditProject.findFirst({
      where: { auditPlanId: id },
    });
    if (inUse) {
      throw new ConflictException(
        'This Planned Engagement is already in use by an Individual OE Plan and cannot be deleted.',
      );
    }
    await this.prisma.auditPlan.delete({ where: { id } });
    return true;
  }
}
