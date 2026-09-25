import type { OePlanReadScope } from '../common/access-scope.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { validateDateRange } from '@oeportal/shared';
import { CodeGeneratorService } from '../code-generator/code-generator.service';
import { PermissionsResolverService } from '../common/permissions-resolver.service';
import {
  PlanItemsService,
  PLAN_ITEM_OWNER,
} from '../common/plan-items.service';
import type { OePlan, PaginatedResponse } from '@oeportal/shared';
import type { UpdateOePlanDto } from './dto/update-oe-plan.dto';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { Prisma } from '../generated/prisma/client';

interface OePlanListOptions {
  search?: string;
  status?: string;
  skip?: number;
  take?: number;
}

/** PLANNING -> SUBMITTED_FOR_APPROVAL -> RELEASED -> CLOSED, plus reject/reopen loops back a step. */
const STATUS_TRANSITION_PERMISSIONS: Record<string, string> = {
  'PLANNING->SUBMITTED_FOR_APPROVAL': 'oe-plans:submit',
  'SUBMITTED_FOR_APPROVAL->RELEASED': 'oe-plans:approve',
  'SUBMITTED_FOR_APPROVAL->PLANNING': 'oe-plans:approve',
  'RELEASED->CLOSED': 'oe-plans:close',
  'CLOSED->RELEASED': 'oe-plans:reopen',
};

/**
 * opExTimeline/approvals are real, flat columns in the database (see the
 * flatten_oe_plan_timeline_and_approvals migration), but the API still accepts and returns
 * each group as a single JSON string, so no existing client needs to change. These helpers are
 * the only place that translates between the two.
 */
/** Only trusts a genuine string from the parsed JSON; anything else (missing, wrong type) is blank. */
const asString = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * A linked Project's department (its topic) is inherited: always present and listed first.
 * Whatever else is stored on the plan is a department added on top of it. Merged on read so
 * a plan can never lose the inherited department, even if a stale client saved without it.
 */
export function mergeDepartments(
  projectTopic: string | null | undefined,
  stored: string,
): string {
  const topic = (projectTopic || '').trim();
  const list = (stored || '')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
  if (!topic) return list.join(',');
  const extras = list.filter((d) => d.toLowerCase() !== topic.toLowerCase());
  return [topic, ...extras].join(',');
}

export const BLANK_OPEX_TIMELINE_FIELDS = {
  opExPresentationDate: '',
  opExNotificationDate: '',
  opExFieldWorkStart: '',
  opExFieldWorkEnd: '',
  opExFindingReportOffset: 0,
  opExFinalReportOffset: 0,
};

export const BLANK_APPROVALS_FIELDS = {
  preparedByName: '',
  preparedByTitle: '',
  preparedDate: '',
  approvedByName: '',
  approvedByTitle: '',
  approvedDate: '',
};

export function serializeOpExTimeline(p: {
  opExPresentationDate: string;
  opExNotificationDate: string;
  opExFieldWorkStart: string;
  opExFieldWorkEnd: string;
  opExFindingReportOffset: number;
  opExFinalReportOffset: number;
}): string {
  return JSON.stringify({
    presentationDate: p.opExPresentationDate,
    notificationDate: p.opExNotificationDate,
    fieldWorkStart: p.opExFieldWorkStart,
    fieldWorkEnd: p.opExFieldWorkEnd,
    findingReportOffset: p.opExFindingReportOffset,
    finalReportOffset: p.opExFinalReportOffset,
  });
}

export function serializeApprovals(p: {
  preparedByName: string;
  preparedByTitle: string;
  preparedDate: string;
  approvedByName: string;
  approvedByTitle: string;
  approvedDate: string;
}): string {
  return JSON.stringify({
    preparedByName: p.preparedByName,
    preparedByTitle: p.preparedByTitle,
    preparedDate: p.preparedDate,
    approvedByName: p.approvedByName,
    approvedByTitle: p.approvedByTitle,
    approvedDate: p.approvedDate,
  });
}

/** `undefined` in -> `undefined` out, so a partial update that omits this field leaves the
 * existing columns untouched instead of blanking them. */
export function parseOpExTimeline(
  raw: string | undefined,
): typeof BLANK_OPEX_TIMELINE_FIELDS | undefined {
  if (raw === undefined) return undefined;
  let obj: Record<string, unknown> = {};
  try {
    obj = raw ? JSON.parse(raw) : {};
  } catch {
    obj = {};
  }
  return {
    opExPresentationDate: asString(obj.presentationDate),
    opExNotificationDate: asString(obj.notificationDate),
    opExFieldWorkStart: asString(obj.fieldWorkStart),
    opExFieldWorkEnd: asString(obj.fieldWorkEnd),
    opExFindingReportOffset: Number(obj.findingReportOffset) || 0,
    opExFinalReportOffset: Number(obj.finalReportOffset) || 0,
  };
}

export function parseApprovals(
  raw: string | undefined,
): typeof BLANK_APPROVALS_FIELDS | undefined {
  if (raw === undefined) return undefined;
  let obj: Record<string, unknown> = {};
  try {
    obj = raw ? JSON.parse(raw) : {};
  } catch {
    obj = {};
  }
  return {
    preparedByName: asString(obj.preparedByName),
    preparedByTitle: asString(obj.preparedByTitle),
    preparedDate: asString(obj.preparedDate),
    approvedByName: asString(obj.approvedByName),
    approvedByTitle: asString(obj.approvedByTitle),
    approvedDate: asString(obj.approvedDate),
  };
}

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
    private readonly planItems: PlanItemsService,
  ) {}

  /**
   * `read` is the caller's view scope (see AccessScopeService.oePlanReadScope): which plans,
   * and which of each plan's schedules / meetings / findings, they may see.
   */
  private listWhere(
    read?: OePlanReadScope,
    options: OePlanListOptions = {},
  ): Prisma.OePlanWhereInput {
    return {
      isDeleted: false,
      ...read?.plans,
      ...(options.status && options.status !== 'ALL'
        ? { status: options.status }
        : {}),
      ...(options.search
        ? {
            OR: [
              { name: { contains: options.search, mode: 'insensitive' } },
              { code: { contains: options.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  async findAll(
    read?: OePlanReadScope,
    options: OePlanListOptions = {},
  ): Promise<OePlan[]> {
    const NOTHING = { id: { in: [] as string[] } };
    const projects = await this.prisma.oePlan.findMany({
      where: this.listWhere(read, options),
      include: {
        members: true,
        executionSchedules: {
          where: { isDeleted: false },
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
        project: true,
      },
      orderBy: { code: 'desc' },
      skip: options.skip,
      take: options.take,
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

    // One batched query per field across every fetched plan/meeting, instead of one per
    // record - this DB is remote, so avoiding per-record round trips matters at any real scale.
    const planIds = projects.map((p) => p.id);
    const meetingIds = projects.flatMap((p) => p.openMeetings.map((m) => m.id));
    const inactiveByOwnerId = new Map(
      projects.map((p) => [p.id, p.inactiveScopeItemIds]),
    );
    const [
      objectivesById,
      dataRequestById,
      scopeById,
      meetingObjectivesById,
      meetingScopeById,
    ] = await Promise.all([
      this.planItems.readMany(PLAN_ITEM_OWNER.OEPLAN_OBJECTIVE.type, planIds),
      this.planItems.readMany(
        PLAN_ITEM_OWNER.OEPLAN_DATA_REQUEST.type,
        planIds,
      ),
      this.planItems.readScopeOverrideMany(planIds, inactiveByOwnerId),
      this.planItems.readMany(
        PLAN_ITEM_OWNER.MEETING_OBJECTIVE.type,
        meetingIds,
      ),
      this.planItems.readMany(PLAN_ITEM_OWNER.MEETING_SCOPE.type, meetingIds),
    ]);

    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      status: p.status as any,
      workflowStage: p.workflowStage as any,
      createdBy: p.createdBy,
      deptPicIds: p.deptPicIds,
      departments: mergeDepartments(p.project?.topic, p.departments),
      annualPlanId: p.annualPlanId || undefined,
      projectId: p.projectId || undefined,
      scope: scopeById.get(p.id) ?? '{"inactiveIds":[],"extraItems":[]}',
      planningDetails: p.planningDetails,
      startDate: p.startDate.toISOString().split('T')[0],
      endDate: p.endDate.toISOString().split('T')[0],
      leaderId: p.leaderId,
      memberNames: p.memberNames,
      closedByName: p.closedByName,
      closedDate: p.closedDate,
      objectives: objectivesById.get(p.id) ?? '[]',
      riskProcess: p.riskProcess,
      riskClass: p.riskClass,
      opEx: p.opEx,
      fieldwork: p.fieldwork,
      outcome: p.outcome,
      dataRequestType: dataRequestById.get(p.id) ?? '[]',
      focusArea: p.focusArea,
      opExTimeline: serializeOpExTimeline(p),
      approvals: serializeApprovals(p),
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
        projectId: m.oePlanId, // API field name kept for backward compatibility; means the OE Plan
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
        objectives: meetingObjectivesById.get(m.id) ?? '[]',
        scope: meetingScopeById.get(m.id) ?? '[]',
        scheduleRows: m.scheduleRows,
        ownerName: m.ownerName,
        lastModifiedBy: m.lastModifiedBy,
      })),
    }));
  }

  async findPage(
    read: OePlanReadScope,
    options: { page: number; pageSize: number; search?: string; status?: string },
  ): Promise<PaginatedResponse<OePlan>> {
    const { page, pageSize } = options;
    const listOptions = {
      search: options.search,
      status: options.status,
      skip: (page - 1) * pageSize,
      take: pageSize,
    };
    const [items, totalItems] = await Promise.all([
      this.findAll(read, listOptions),
      this.prisma.oePlan.count({ where: this.listWhere(read, listOptions) }),
    ]);

    return {
      items,
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    };
  }

  /** A Project can back at most one Individual OE Plan. */
  private async ensureProjectAvailable(
    projectId: string,
    excludeOePlanId?: string,
  ): Promise<void> {
    const existing = await this.prisma.oePlan.findFirst({
      where: {
        projectId,
        isDeleted: false,
        ...(excludeOePlanId ? { id: { not: excludeOePlanId } } : {}),
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
    projectId: string | null = null,
    createdBy: string = '',
  ): Promise<OePlan> {
    const dateError = validateDateRange(startDate, endDate);
    if (dateError) throw new BadRequestException(dateError);

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

    let inheritedObjectives = '[]';

    if (projectId) {
      const parentProject = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: { annualPlan: true },
      });
      if (parentProject?.annualPlan?.status !== 'APPROVED') {
        throw new BadRequestException(
          'The parent Annual Plan must be APPROVED before an Individual OE Plan can be created under it.',
        );
      }
      await this.ensureProjectAvailable(projectId);
      // Objectives are inherited from the Project as plain text (the editor shows them
      // read-only, never entered independently). Scope is NOT copied here: OePlan.scope
      // holds a { inactiveIds, extraItems } JSON override on top of the Project's scope,
      // not the scope text itself - see ScopeOverride in planning-client.tsx.
      inheritedObjectives = await this.planItems.readOne(
        PLAN_ITEM_OWNER.PROJECT_OBJECTIVE.type,
        projectId,
      );
    }

    const { inactiveScopeItemIds, extraItemsRaw } =
      this.planItems.parseScopeOverrideInput(scope);

    const p = await this.prisma.oePlan.create({
      data: {
        name,
        code: normalizedCode,
        status,
        inactiveScopeItemIds: inactiveScopeItemIds ?? [],
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
        projectId,
        riskProcess: '',
        riskClass: '',
        opEx: '',
        fieldwork: '',
        outcome: '',
        focusArea: '',
        ...BLANK_OPEX_TIMELINE_FIELDS,
        ...BLANK_APPROVALS_FIELDS,
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
    await Promise.all([
      this.planItems.writeList(
        PLAN_ITEM_OWNER.OEPLAN_OBJECTIVE.type,
        p.id,
        inheritedObjectives,
        PLAN_ITEM_OWNER.OEPLAN_OBJECTIVE.prefix,
      ),
      this.planItems.writeScopeExtraItems(p.id, extraItemsRaw),
    ]);
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
      projectId: p.projectId || undefined,
      // Built from what we just wrote, not a re-read - avoids extra queries for a brand-new
      // record nothing else could have changed concurrently.
      scope: JSON.stringify({
        inactiveIds: inactiveScopeItemIds ?? [],
        extraItems: JSON.parse(extraItemsRaw ?? '[]') as unknown,
      }),
      planningDetails: p.planningDetails,
      startDate: p.startDate.toISOString().split('T')[0],
      endDate: p.endDate.toISOString().split('T')[0],
      leaderId: p.leaderId,
      memberNames: p.memberNames,
      closedByName: p.closedByName,
      closedDate: p.closedDate,
      objectives: inheritedObjectives,
      riskProcess: p.riskProcess,
      riskClass: p.riskClass,
      opEx: p.opEx,
      fieldwork: p.fieldwork,
      outcome: p.outcome,
      dataRequestType: '[]',
      focusArea: p.focusArea,
      opExTimeline: serializeOpExTimeline(p),
      approvals: serializeApprovals(p),
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

  async update(
    id: string,
    updates: UpdateOePlanDto,
    actorName: string,
  ): Promise<OePlan | null> {
    // A soft-deleted plan is not found, full stop - a plain edit must never resurrect its
    // content by writing to a row that's supposed to be gone.
    const target = await this.prisma.oePlan.findUnique({
      where: { id },
      select: { isDeleted: true, status: true },
    });
    if (!target || target.isDeleted) {
      throw new NotFoundException('Individual OE Plan not found');
    }

    // Who closed this plan, stamped from the authenticated caller - never trust a
    // client-supplied value (there isn't one; closedByName/closedDate aren't on
    // UpdateOePlanDto, so ValidationPipe's whitelist already strips anything sent for them).
    // Cleared on any transition away from CLOSED so a reclosed plan never shows a stale name.
    let closedTracking: { closedByName: string; closedDate: string } | undefined;
    if (updates.status !== undefined && updates.status !== target.status) {
      if (updates.status === 'CLOSED') {
        closedTracking = {
          closedByName: actorName,
          closedDate: new Date().toISOString().split('T')[0],
        };
      } else if (target.status === 'CLOSED') {
        closedTracking = { closedByName: '', closedDate: '' };
      }
    }

    if (updates.startDate !== undefined || updates.endDate !== undefined) {
      // Only one side of the range may be changing; resolve the other from the current
      // record so a partial edit can never leave the plan in an inverted date range.
      const current = await this.prisma.oePlan.findUnique({
        where: { id },
        select: { startDate: true, endDate: true },
      });
      const effectiveStart =
        updates.startDate ?? current?.startDate.toISOString();
      const effectiveEnd = updates.endDate ?? current?.endDate.toISOString();
      const dateError =
        effectiveStart && effectiveEnd
          ? validateDateRange(effectiveStart, effectiveEnd)
          : null;
      if (dateError) throw new BadRequestException(dateError);
    }

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

    if (updates.projectId) {
      await this.ensureProjectAvailable(updates.projectId, id);
    }

    const { inactiveScopeItemIds, extraItemsRaw } =
      this.planItems.parseScopeOverrideInput(updates.scope);

    const p = await this.prisma.oePlan.update({
      where: { id },
      data: {
        name: updates.name,
        status: updates.status,
        workflowStage: updates.workflowStage,
        deptPicIds: updates.deptPicIds,
        departments: updates.departments,
        inactiveScopeItemIds,
        planningDetails: updates.planningDetails,
        startDate: updates.startDate ? new Date(updates.startDate) : undefined,
        endDate: updates.endDate ? new Date(updates.endDate) : undefined,
        leaderId: updates.leaderId,
        memberNames: updates.memberNames,
        riskProcess: updates.riskProcess,
        riskClass: updates.riskClass,
        opEx: updates.opEx,
        fieldwork: updates.fieldwork,
        outcome: updates.outcome,
        focusArea: updates.focusArea,
        ...parseOpExTimeline(updates.opExTimeline),
        ...parseApprovals(updates.approvals),
        annualPlanId: updates.annualPlanId,
        projectId: updates.projectId,
        members: memberConnections,
        ...closedTracking,
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
        project: { select: { topic: true } },
      },
      relationLoadStrategy: 'join',
    });

    const finalSchedules = p.executionSchedules;
    const finalOpenMeetings = p.openMeetings;

    await Promise.all([
      this.planItems.writeList(
        PLAN_ITEM_OWNER.OEPLAN_OBJECTIVE.type,
        id,
        updates.objectives,
        PLAN_ITEM_OWNER.OEPLAN_OBJECTIVE.prefix,
      ),
      this.planItems.writeList(
        PLAN_ITEM_OWNER.OEPLAN_DATA_REQUEST.type,
        id,
        updates.dataRequestType,
        PLAN_ITEM_OWNER.OEPLAN_DATA_REQUEST.prefix,
      ),
      this.planItems.writeScopeExtraItems(id, extraItemsRaw),
    ]);

    // Re-read rather than trust `updates.*` directly: this is a partial update, so a field this
    // call didn't touch must still reflect its current, unchanged value.
    const meetingIds = finalOpenMeetings.map((m) => m.id);
    const [
      objectives,
      scope,
      dataRequestType,
      meetingObjectivesById,
      meetingScopeById,
    ] = await Promise.all([
      this.planItems.readOne(PLAN_ITEM_OWNER.OEPLAN_OBJECTIVE.type, id),
      this.planItems.readScopeOverride(id, p.inactiveScopeItemIds),
      this.planItems.readOne(PLAN_ITEM_OWNER.OEPLAN_DATA_REQUEST.type, id),
      this.planItems.readMany(
        PLAN_ITEM_OWNER.MEETING_OBJECTIVE.type,
        meetingIds,
      ),
      this.planItems.readMany(PLAN_ITEM_OWNER.MEETING_SCOPE.type, meetingIds),
    ]);

    return {
      id: p.id,
      name: p.name,
      code: p.code,
      status: p.status as any,
      workflowStage: p.workflowStage as any,
      createdBy: p.createdBy,
      deptPicIds: p.deptPicIds,
      departments: mergeDepartments(p.project?.topic, p.departments),
      annualPlanId: p.annualPlanId || undefined,
      projectId: p.projectId || undefined,
      scope,
      planningDetails: p.planningDetails,
      startDate: p.startDate.toISOString().split('T')[0],
      endDate: p.endDate.toISOString().split('T')[0],
      leaderId: p.leaderId,
      memberNames: p.memberNames,
      closedByName: p.closedByName,
      closedDate: p.closedDate,
      objectives,
      riskProcess: p.riskProcess,
      riskClass: p.riskClass,
      opEx: p.opEx,
      fieldwork: p.fieldwork,
      outcome: p.outcome,
      dataRequestType,
      focusArea: p.focusArea,
      opExTimeline: serializeOpExTimeline(p),
      approvals: serializeApprovals(p),
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
        projectId: m.oePlanId, // API field name kept for backward compatibility; means the OE Plan
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
        objectives: meetingObjectivesById.get(m.id) ?? '[]',
        scope: meetingScopeById.get(m.id) ?? '[]',
        scheduleRows: m.scheduleRows,
        ownerName: m.ownerName,
        lastModifiedBy: m.lastModifiedBy,
      })),
    };
  }

  /**
   * Soft delete: this is a real audit record (findings, meeting minutes, schedules, reports
   * all hang off it via cascade), so a hard delete would silently destroy all of it with no
   * undo. `isDeleted` rows are excluded from findAll() and treated as not-found everywhere
   * else in this service - nothing is actually removed from the database.
   */
  async remove(id: string): Promise<boolean> {
    try {
      const { count } = await this.prisma.oePlan.updateMany({
        where: { id, isDeleted: false },
        data: { isDeleted: true },
      });
      return count > 0;
    } catch (e) {
      console.error('Failed to delete project:', e);
      return false;
    }
  }
}
