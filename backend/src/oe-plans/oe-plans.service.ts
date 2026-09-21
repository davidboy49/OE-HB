import type { OePlanReadScope } from '../common/access-scope.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../code-generator/code-generator.service';
import { PermissionsResolverService } from '../common/permissions-resolver.service';
import type { OePlan } from '@oeportal/shared';
import type { UpdateOePlanDto } from './dto/update-oe-plan.dto';
import type { AuthenticatedUser } from '../auth/auth.types';

/** PLANNING -> SUBMITTED_FOR_APPROVAL -> RELEASED -> CLOSED, plus reject/reopen loops back a step. */
const STATUS_TRANSITION_PERMISSIONS: Record<string, string> = {
  'PLANNING->SUBMITTED_FOR_APPROVAL': 'oe-plans:submit',
  'SUBMITTED_FOR_APPROVAL->RELEASED': 'oe-plans:approve',
  'SUBMITTED_FOR_APPROVAL->PLANNING': 'oe-plans:approve',
  'RELEASED->CLOSED': 'oe-plans:close',
  'CLOSED->RELEASED': 'oe-plans:reopen',
};

/**
 * Ported from src/lib/dbService.ts (getProjects, createProject, updateProject,
 * deleteProject). The include/mapping shape logic below is copied as-is so the
 * returned object shape matches exactly what the frontend already expects.
 */
@Injectable()
export class OePlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGenerator: CodeGeneratorService,
    private readonly permissionsResolver: PermissionsResolverService,
  ) {}

  /**
   * `read` is the caller's view scope (see AccessScopeService.oePlanReadScope): which plans,
   * and which of each plan's schedules / meetings / findings, they may see.
   */
  async findAll(read?: OePlanReadScope): Promise<OePlan[]> {
    const NOTHING = { id: { in: [] as string[] } };
    const projects = await this.prisma.oePlan.findMany({
      where: read?.plans,
      include: {
        members: true,
        executionSchedules: {
          include: {
            findings: {
              where: read ? (read.findings ?? NOTHING) : undefined,
              include: {
                member: true,
              },
            },
          },
        },
        openMeetings: {
          where: {
            isDeleted: false,
            ...(read ? (read.meetings ?? NOTHING) : {}),
          },
        },
        plannedEngagement: true,
      },
      orderBy: { code: 'desc' },
      // This DB is remote (~200ms/round-trip); the default "query" strategy issues
      // one round trip per relation (~6 here). "join" fetches it all in one SQL
      // statement instead. Row counts here are small, so the join's duplicated-row
      // payload cost is negligible next to the round-trip savings.
      relationLoadStrategy: 'join',
    });
    // Schedules carry the findings above, so they are loaded unfiltered and narrowed here.
    let visibleScheduleIds: Set<string> | null = null;
    if (
      read &&
      (read.schedules === null || Object.keys(read.schedules).length)
    ) {
      visibleScheduleIds = new Set(
        read.schedules === null
          ? []
          : (
              await this.prisma.executionSchedule.findMany({
                where: read.schedules,
                select: { id: true },
              })
            ).map((r) => r.id),
      );
    }
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      status: p.status as any,
      workflowStage: p.workflowStage as any,
      createdBy: p.createdBy,
      deptPicIds: p.deptPicIds,
      departments: p.plannedEngagement?.topic || p.departments,
      annualPlanId: p.annualPlanId || undefined,
      plannedEngagementId: p.plannedEngagementId || undefined,
      scope: p.scope,
      planningDetails: p.planningDetails,
      startDate: p.startDate.toISOString().split('T')[0],
      endDate: p.endDate.toISOString().split('T')[0],
      leaderId: p.leaderId,
      memberNames: p.memberNames,
      objectives: p.objectives,
      riskProcess: p.riskProcess,
      riskClass: p.riskClass,
      opEx: p.opEx,
      fieldwork: p.fieldwork,
      outcome: p.outcome,
      dataRequestType: p.dataRequestType,
      focusArea: p.focusArea,
      opExTimeline: p.opExTimeline,
      approvals: p.approvals,
      memberIds: p.members.map((a) => a.id),
      findings: p.executionSchedules
        ? p.executionSchedules.flatMap((es) =>
            (es.findings || []).map((f) => ({
              id: f.id,
              title: f.title,
              description: f.description,
              status: f.status,
              severity: f.severity,
              recommendation: f.recommendation,
              executionScheduleId: f.executionScheduleId,
              memberName: f.member?.name,
              createdAt: f.createdAt.toISOString(),
            })),
          )
        : [],
      executionSchedules: p.executionSchedules
        .filter((e) => !visibleScheduleIds || visibleScheduleIds.has(e.id))
        .map((e) => ({
          id: e.id,
          visitNumber: e.visitNumber,
          language: e.language,
          status: e.status,
          departments: e.departments,
          ownerName: e.ownerName,
          lastModifiedBy: e.lastModifiedBy,
          scheduleRows: e.scheduleRows,
          attendeeConfirmations: e.attendeeConfirmations,
        })),
      openMeetings: p.openMeetings.map((m) => ({
        id: m.id,
        projectId: m.projectId,
        departments: m.departments,
        address: m.address,
        visitNumber: m.visitNumber,
        actualVisitDate: m.actualVisitDate,
        oePeriod: m.oePeriod,
        leadExecution: m.leadExecution,
        teamMembers: m.teamMembers,
        additionalAttendees: m.additionalAttendees,
        attendeeConfirmations: m.attendeeConfirmations,
        standards: m.standards,
        status: m.status as any,
        objectives: m.objectives,
        scope: m.scope,
        scheduleRows: m.scheduleRows,
        ownerName: m.ownerName,
        lastModifiedBy: m.lastModifiedBy,
      })),
    }));
  }

  /** A Planned Engagement can back at most one Individual OE Plan. */
  private async ensurePlannedEngagementAvailable(
    plannedEngagementId: string,
    excludeProjectId?: string,
  ): Promise<void> {
    const existing = await this.prisma.oePlan.findFirst({
      where: {
        plannedEngagementId,
        ...(excludeProjectId ? { id: { not: excludeProjectId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictException(
        'This Project has already been selected for another Individual OE Plan.',
      );
    }
  }

  async create(
    name: string,
    code: string,
    status: string,
    scope: string,
    planningDetails: string,
    startDate: string,
    endDate: string,
    leaderId: string | null,
    departments: string = '',
    annualPlanId: string | null = null,
    plannedEngagementId: string | null = null,
    createdBy: string = '',
  ): Promise<OePlan> {
    let normalizedCode = (code || '').trim().toUpperCase();

    if (!normalizedCode || normalizedCode === 'AUTO') {
      normalizedCode = await this.codeGenerator.generateDocumentCode('OEP');
    }

    const existing = await this.prisma.oePlan.findFirst({
      where: { code: normalizedCode },
    });
    if (existing) {
      throw new ConflictException(
        `An OE Plan with code ${normalizedCode} already exists.`,
      );
    }

    let inheritedObjectives = '';

    if (plannedEngagementId) {
      const parentPlannedEngagement =
        await this.prisma.plannedEngagement.findUnique({
          where: { id: plannedEngagementId },
          include: { annualPlan: true },
        });
      if (parentPlannedEngagement?.annualPlan?.status !== 'APPROVED') {
        throw new BadRequestException(
          'The parent Annual Plan must be APPROVED before an Individual OE Plan can be created under it.',
        );
      }
      await this.ensurePlannedEngagementAvailable(plannedEngagementId);
      // Objectives are inherited from the Planned Engagement as plain text (the
      // editor shows them read-only, never entered independently). Scope is NOT
      // copied here: OePlan.scope holds a { inactiveIds, extraItems } JSON
      // override on top of the Planned Engagement's scope, not the scope text
      // itself - see ScopeOverride in planning-client.tsx.
      inheritedObjectives = parentPlannedEngagement.objectives || '';
    }

    const p = await this.prisma.oePlan.create({
      data: {
        name,
        code: normalizedCode,
        status,
        scope,
        planningDetails,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        leaderId,
        memberNames: '',
        workflowStage: 'DRAFTING',
        createdBy,
        deptPicIds: '',
        departments,
        annualPlanId,
        plannedEngagementId,
        objectives: inheritedObjectives,
        riskProcess: '',
        riskClass: '',
        opEx: '',
        fieldwork: '',
        outcome: '',
        dataRequestType: '',
        focusArea: '',
        opExTimeline:
          '{"presentationDate":"","notificationDate":"","fieldWorkStart":"","fieldWorkEnd":"","findingReportOffset":0,"finalReportOffset":0}',
        approvals:
          '{"preparedByName":"","preparedByTitle":"","preparedDate":"","approvedByName":"","approvedByTitle":"","approvedDate":""}',
      },
      include: {
        members: true,
        executionSchedules: {
          include: {
            findings: {
              include: {
                member: true,
              },
            },
          },
        },
      },
      relationLoadStrategy: 'join',
    });
    return {
      id: p.id,
      name: p.name,
      code: p.code,
      status: p.status as any,
      workflowStage: p.workflowStage as any,
      createdBy: p.createdBy,
      deptPicIds: p.deptPicIds,
      departments: p.departments,
      annualPlanId: p.annualPlanId || undefined,
      plannedEngagementId: p.plannedEngagementId || undefined,
      scope: p.scope,
      planningDetails: p.planningDetails,
      startDate: p.startDate.toISOString().split('T')[0],
      endDate: p.endDate.toISOString().split('T')[0],
      leaderId: p.leaderId,
      memberNames: p.memberNames,
      objectives: p.objectives,
      riskProcess: p.riskProcess,
      riskClass: p.riskClass,
      opEx: p.opEx,
      fieldwork: p.fieldwork,
      outcome: p.outcome,
      dataRequestType: p.dataRequestType,
      focusArea: p.focusArea,
      opExTimeline: p.opExTimeline,
      approvals: p.approvals,
      memberIds: p.members.map((a) => a.id),
      findings: p.executionSchedules
        ? p.executionSchedules.flatMap((es) =>
            (es.findings || []).map((f) => ({
              id: f.id,
              title: f.title,
              description: f.description,
              status: f.status,
              severity: f.severity,
              recommendation: f.recommendation,
              executionScheduleId: f.executionScheduleId,
              memberName: f.member?.name,
              createdAt: f.createdAt.toISOString(),
            })),
          )
        : [],
      executionSchedules: p.executionSchedules
        ? p.executionSchedules.map((e) => ({
            id: e.id,
            visitNumber: e.visitNumber,
            language: e.language,
            status: e.status,
            departments: e.departments,
            ownerName: e.ownerName,
            lastModifiedBy: e.lastModifiedBy,
            scheduleRows: e.scheduleRows,
            attendeeConfirmations: e.attendeeConfirmations,
          }))
        : [],
    };
  }

  /**
   * The single PATCH endpoint handles both plain field edits and status
   * transitions (the frontend always sends the full form body + `status`).
   * A real status change requires the specific submit/approve/close/reopen
   * permission for that transition instead of the generic `:update` key;
   * anything else (no status field, or status unchanged) just needs `:update`.
   */
  async assertUpdateAllowed(
    id: string,
    updates: UpdateOePlanDto,
    user: AuthenticatedUser,
  ): Promise<void> {
    const current = await this.prisma.oePlan.findUnique({
      where: { id },
      select: { status: true },
    });
    const isStatusChange =
      updates.status !== undefined &&
      current !== null &&
      updates.status !== current.status;

    if (!isStatusChange) {
      await this.permissionsResolver.requirePermission(user, 'oe-plans:update');
      return;
    }

    const requiredKey =
      STATUS_TRANSITION_PERMISSIONS[`${current.status}->${updates.status}`];
    if (!requiredKey) {
      // Unmapped transition (shouldn't happen via the UI) - fall back to the
      // generic edit permission rather than hard-blocking an unknown case.
      await this.permissionsResolver.requirePermission(user, 'oe-plans:update');
      return;
    }
    await this.permissionsResolver.requirePermission(user, requiredKey);
  }

  async update(id: string, updates: UpdateOePlanDto): Promise<OePlan | null> {
    let memberConnections: { set: { id: string }[] } | undefined = undefined;
    if (updates.memberIds) {
      const validUsers = await this.prisma.user.findMany({
        where: {
          OR: [
            { id: { in: updates.memberIds } },
            { name: { in: updates.memberIds } },
          ],
        },
      });
      memberConnections = {
        set: validUsers.map((u) => ({ id: u.id })),
      };
    }

    if (updates.plannedEngagementId) {
      await this.ensurePlannedEngagementAvailable(
        updates.plannedEngagementId,
        id,
      );
    }

    const p = await this.prisma.oePlan.update({
      where: { id },
      data: {
        name: updates.name,
        status: updates.status,
        workflowStage: updates.workflowStage,
        deptPicIds: updates.deptPicIds,
        departments: updates.departments,
        scope: updates.scope,
        planningDetails: updates.planningDetails,
        startDate: updates.startDate ? new Date(updates.startDate) : undefined,
        endDate: updates.endDate ? new Date(updates.endDate) : undefined,
        leaderId: updates.leaderId,
        memberNames: updates.memberNames,
        objectives: updates.objectives,
        riskProcess: updates.riskProcess,
        riskClass: updates.riskClass,
        opEx: updates.opEx,
        fieldwork: updates.fieldwork,
        outcome: updates.outcome,
        dataRequestType: updates.dataRequestType,
        focusArea: updates.focusArea,
        opExTimeline: updates.opExTimeline,
        approvals: updates.approvals,
        annualPlanId: updates.annualPlanId,
        plannedEngagementId: updates.plannedEngagementId,
        members: memberConnections,
      },
      include: {
        members: true,
        executionSchedules: {
          include: {
            findings: {
              include: {
                member: true,
              },
            },
          },
        },
        openMeetings: {
          where: { isDeleted: false },
        },
      },
      relationLoadStrategy: 'join',
    });

    const finalSchedules = p.executionSchedules;
    const finalOpenMeetings = p.openMeetings;

    return {
      id: p.id,
      name: p.name,
      code: p.code,
      status: p.status as any,
      workflowStage: p.workflowStage as any,
      createdBy: p.createdBy,
      deptPicIds: p.deptPicIds,
      departments: p.departments,
      annualPlanId: p.annualPlanId || undefined,
      plannedEngagementId: p.plannedEngagementId || undefined,
      scope: p.scope,
      planningDetails: p.planningDetails,
      startDate: p.startDate.toISOString().split('T')[0],
      endDate: p.endDate.toISOString().split('T')[0],
      leaderId: p.leaderId,
      memberNames: p.memberNames,
      objectives: p.objectives,
      riskProcess: p.riskProcess,
      riskClass: p.riskClass,
      opEx: p.opEx,
      fieldwork: p.fieldwork,
      outcome: p.outcome,
      dataRequestType: p.dataRequestType,
      focusArea: p.focusArea,
      opExTimeline: p.opExTimeline,
      approvals: p.approvals,
      memberIds: p.members.map((a) => a.id),
      findings: p.executionSchedules
        ? p.executionSchedules.flatMap((es) =>
            (es.findings || []).map((f) => ({
              id: f.id,
              title: f.title,
              description: f.description,
              status: f.status,
              severity: f.severity,
              recommendation: f.recommendation,
              executionScheduleId: f.executionScheduleId,
              memberName: f.member?.name,
              createdAt: f.createdAt.toISOString(),
            })),
          )
        : [],
      executionSchedules: finalSchedules.map((e) => ({
        id: e.id,
        visitNumber: e.visitNumber,
        language: e.language,
        status: e.status,
        departments: e.departments,
        ownerName: e.ownerName,
        lastModifiedBy: e.lastModifiedBy,
        scheduleRows: e.scheduleRows,
        attendeeConfirmations: e.attendeeConfirmations,
      })),
      openMeetings: finalOpenMeetings.map((m) => ({
        id: m.id,
        projectId: m.projectId,
        departments: m.departments,
        address: m.address,
        visitNumber: m.visitNumber,
        actualVisitDate: m.actualVisitDate,
        oePeriod: m.oePeriod,
        leadExecution: m.leadExecution,
        teamMembers: m.teamMembers,
        additionalAttendees: m.additionalAttendees,
        attendeeConfirmations: m.attendeeConfirmations,
        standards: m.standards,
        status: m.status as any,
        objectives: m.objectives,
        scope: m.scope,
        scheduleRows: m.scheduleRows,
        ownerName: m.ownerName,
        lastModifiedBy: m.lastModifiedBy,
      })),
    };
  }

  async remove(id: string): Promise<boolean> {
    try {
      await this.prisma.oePlan.delete({
        where: { id },
      });
      return true;
    } catch (e) {
      console.error('Failed to delete project:', e);
      return false;
    }
  }
}
