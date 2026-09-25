import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { assertOePlanReleased } from '../common/assert-oe-plan-status';
import {
  PlanItemsService,
  PLAN_ITEM_OWNER,
} from '../common/plan-items.service';

const CONFLICT_MESSAGE =
  'Someone else changed this Execution Schedule after you loaded it. Reload and try again.';

export interface CreateExecutionScheduleInput {
  /** The Individual OE Plan this schedule belongs to. Called `projectId` in the API for
   * backward compatibility with existing clients - it is not a Project (see Prisma's
   * `oePlanId`, which is what it is actually stored as). */
  projectId: string;
  departments: string;
  address: string;
  visitNumber: string;
  actualVisitDate: string;
  oePeriod: string;
  leadExecution: string;
  teamMembers: string;
  additionalAttendees: string;
  attendeeConfirmations?: string;
  standards: string;
  language: string;
  status?: string;
  objectives: string;
  scope: string;
  scheduleRows: string;
  ownerName?: string;
  lastModifiedBy?: string;
}

export interface UpdateExecutionScheduleInput {
  departments?: string;
  address?: string;
  visitNumber?: string;
  actualVisitDate?: string;
  oePeriod?: string;
  leadExecution?: string;
  teamMembers?: string;
  additionalAttendees?: string;
  attendeeConfirmations?: string;
  standards?: string;
  language?: string;
  status?: string;
  objectives?: string;
  scope?: string;
  scheduleRows?: string;
  ownerName?: string;
  lastModifiedBy?: string;
  /** See UpdateExecutionScheduleDto - when given, rejects the write if the schedule has been
   * changed since this timestamp instead of silently overwriting the other change. */
  expectedUpdatedAt?: string;
}

export interface ResolveFindingRowInput {
  correctiveFinalDate?: string;
  correctiveFinalRemarks?: string;
  attachments?: unknown[];
  resolve?: boolean;
  expectedUpdatedAt?: string;
}

export interface DepartmentConsentInput {
  status: string;
  acceptedByUserId: string;
  acceptedByUserName: string;
  acceptedByUserEmail: string;
  timestamp: string;
  comments?: string;
  /** That department's own Concern of the Department Owner - independent per department, submitted by whoever signs off for it. */
  departmentConcern?: string;
}

/**
 * Port of the ExecutionSchedule slice of frontend/src/lib/dbService.ts
 * (lines 721-860 and 1339-1523) + frontend/src/app/actions.ts (lines 293-409).
 */
@Injectable()
export class ExecutionSchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planItems: PlanItemsService,
  ) {}

  /**
   * Postgres-portable rewrite of dbService's module-level `getScheduleAttendeeConfirmations`
   * (dbService.ts:5-16), which originally used SQLite-style `$queryRawUnsafe` with `?`
   * placeholders. Uses Prisma's tagged-template `$queryRaw` + `Prisma.join` instead, since
   * Postgres doesn't support `?` placeholders and tagged templates are provider-portable.
   */
  private async getScheduleAttendeeConfirmations(
    ids: string[],
  ): Promise<Record<string, string>> {
    if (ids.length === 0) return {};
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; attendeeConfirmations: string | null }>
    >`
      SELECT id, "attendeeConfirmations" FROM "ExecutionSchedule" WHERE id IN (${Prisma.join(ids)})
    `;
    return rows.reduce<Record<string, string>>((map, row) => {
      map[row.id] = row.attendeeConfirmations || '{}';
      return map;
    }, {});
  }

  /** Postgres-portable rewrite of dbService's module-level `updateScheduleAttendeeConfirmations` (dbService.ts:18-25). */
  private async updateScheduleAttendeeConfirmations(
    id: string,
    attendeeConfirmations?: string,
  ): Promise<void> {
    if (attendeeConfirmations === undefined) return;
    await this.prisma
      .$executeRaw`UPDATE "ExecutionSchedule" SET "attendeeConfirmations" = ${attendeeConfirmations} WHERE id = ${id}`;
  }

  /**
   * Shared response shape used by findAll/create/findOne (dbService.ts:730-757, 795-822,
   * 831-858). `projectId`/`projectName`/`projectCode` are kept as the API's field names for
   * backward compatibility, even though they describe the parent Individual OE Plan
   * (`oePlanId` in the database), not a Project.
   */
  private toDto(
    s: any,
    attendeeConfirmationsOverride?: string,
    objectivesOverride?: string,
    scopeOverride?: string,
  ): any {
    return {
      id: s.id,
      projectId: s.oePlanId,
      projectName: s.oePlan?.name,
      projectCode: s.oePlan?.code,
      departments: s.departments,
      address: s.address,
      visitNumber: s.visitNumber,
      actualVisitDate: s.actualVisitDate,
      oePeriod: s.oePeriod,
      leadExecution: s.leadExecution,
      teamMembers: s.teamMembers,
      additionalAttendees: s.additionalAttendees,
      attendeeConfirmations:
        attendeeConfirmationsOverride ?? s.attendeeConfirmations ?? '{}',
      standards: s.standards,
      language: s.language,
      status: s.status,
      objectives: objectivesOverride ?? '[]',
      scope: scopeOverride ?? '[]',
      scheduleRows: s.scheduleRows,
      ownerName: s.ownerName,
      lastModifiedBy: s.lastModifiedBy,
      qrToken: s.qrToken ?? s.id,
      departmentConsents: s.departmentConsents ?? '{}',
      createdAt:
        s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
      updatedAt:
        s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
    };
  }

  /** `where` is the caller's view scope (see AccessScopeService). */
  async findAll(
    where: Prisma.ExecutionScheduleWhereInput = {},
  ): Promise<any[]> {
    const schedules = await this.prisma.executionSchedule.findMany({
      where: { isDeleted: false, ...where },
      include: { oePlan: true },
      orderBy: { createdAt: 'desc' },
    });
    const ids = schedules.map((s) => s.id);
    const [confirmationMap, objectivesById, scopeById] = await Promise.all([
      this.getScheduleAttendeeConfirmations(ids),
      this.planItems.readMany(PLAN_ITEM_OWNER.SCHEDULE_OBJECTIVE.type, ids),
      this.planItems.readMany(PLAN_ITEM_OWNER.SCHEDULE_SCOPE.type, ids),
    ]);
    return schedules.map((s) =>
      this.toDto(
        s,
        confirmationMap[s.id],
        objectivesById.get(s.id),
        scopeById.get(s.id),
      ),
    );
  }

  /** The owner is always the authenticated creator (actorName), never a client-supplied value. */
  async create(
    data: CreateExecutionScheduleInput,
    actorName: string,
  ): Promise<any> {
    await assertOePlanReleased(this.prisma, data.projectId);

    const {
      attendeeConfirmations,
      projectId,
      objectives,
      scope,
      ...createData
    } = data;
    const s = await this.prisma.executionSchedule.create({
      // Spread first so a client-supplied ownerName/lastModifiedBy is overridden.
      data: {
        ...createData,
        oePlanId: projectId,
        ownerName: actorName,
        lastModifiedBy: actorName,
      },
      include: { oePlan: true },
    });
    await Promise.all([
      this.updateScheduleAttendeeConfirmations(s.id, attendeeConfirmations),
      this.planItems.writeList(
        PLAN_ITEM_OWNER.SCHEDULE_OBJECTIVE.type,
        s.id,
        objectives,
        PLAN_ITEM_OWNER.SCHEDULE_OBJECTIVE.prefix,
      ),
      this.planItems.writeList(
        PLAN_ITEM_OWNER.SCHEDULE_SCOPE.type,
        s.id,
        scope,
        PLAN_ITEM_OWNER.SCHEDULE_SCOPE.prefix,
      ),
    ]);
    return this.toDto(s, attendeeConfirmations, objectives, scope);
  }

  async findOne(id: string): Promise<any | null> {
    const s = await this.prisma.executionSchedule.findUnique({
      where: { id },
      include: { oePlan: true },
    });
    if (!s || s.isDeleted) return null;
    const [confirmationMap, objectives, scope] = await Promise.all([
      this.getScheduleAttendeeConfirmations([id]),
      this.planItems.readOne(PLAN_ITEM_OWNER.SCHEDULE_OBJECTIVE.type, id),
      this.planItems.readOne(PLAN_ITEM_OWNER.SCHEDULE_SCOPE.type, id),
    ]);
    return this.toDto(s, confirmationMap[s.id], objectives, scope);
  }

  /**
   * Atomically merges one key into a JSON-map column, entirely inside a single UPDATE
   * statement (Postgres's `jsonb_set` does the read-modify-write under the row's own lock).
   * This is what makes it safe against two people writing two different keys of the same
   * column at once - unlike the read-in-application-code/JSON.parse/mutate/JSON.stringify/
   * write-back pattern this replaces, where the second writer's save silently discards
   * whatever the first writer just added, because it never saw it.
   */
  private async mergeJsonColumn(
    column: 'departmentConsents' | 'attendeeConfirmations',
    id: string,
    key: string,
    value: unknown,
  ): Promise<void> {
    const json = JSON.stringify(value);
    if (column === 'departmentConsents') {
      await this.prisma.$executeRaw`
        UPDATE "ExecutionSchedule"
        SET "departmentConsents" = jsonb_set(
          COALESCE("departmentConsents", '{}')::jsonb, ARRAY[${key}]::text[], ${json}::jsonb, true
        )::text
        WHERE id = ${id}
      `;
    } else {
      await this.prisma.$executeRaw`
        UPDATE "ExecutionSchedule"
        SET "attendeeConfirmations" = jsonb_set(
          COALESCE("attendeeConfirmations", '{}')::jsonb, ARRAY[${key}]::text[], ${json}::jsonb, true
        )::text
        WHERE id = ${id}
      `;
    }
  }

  /**
   * Gives every row in a `scheduleRows` JSON array a stable `id` if it doesn't already have
   * one, so resolveFindingRow (and anything else that needs to target a single row) has
   * something to match on. Runs on every ordinary save, so rows saved before this field
   * existed pick up an id the next time anyone touches the report - no migration needed.
   * Returns the input unchanged (not re-serialized) when nothing needed backfilling.
   */
  private backfillRowIds(scheduleRows: string): string {
    let rows: unknown;
    try {
      rows = JSON.parse(scheduleRows);
    } catch {
      return scheduleRows;
    }
    if (!Array.isArray(rows)) return scheduleRows;
    let changed = false;
    const withIds = rows.map((r) => {
      if (r && typeof r === 'object' && !(r as { id?: string }).id) {
        changed = true;
        return { ...r, id: randomUUID() };
      }
      return r;
    });
    return changed ? JSON.stringify(withIds) : scheduleRows;
  }

  /**
   * Records a single department's consent decision and fans it out to sibling schedules on
   * the same OE Plan. Each write is a single atomic jsonb_set (see mergeJsonColumn) rather
   * than a parse/mutate/stringify round trip, so two departments consenting at the same
   * moment can never make one of them disappear.
   */
  async updateDepartmentConsent(
    scheduleId: string,
    departmentId: string,
    consentObj: DepartmentConsentInput,
  ): Promise<any> {
    const s = await this.prisma.executionSchedule.findUnique({
      where: { id: scheduleId },
    });
    if (!s || s.isDeleted) {
      throw new NotFoundException('Execution Schedule not found');
    }

    await this.mergeJsonColumn(
      'departmentConsents',
      scheduleId,
      departmentId,
      consentObj,
    );

    if (s.oePlanId) {
      const siblings = await this.prisma.executionSchedule.findMany({
        where: {
          oePlanId: s.oePlanId,
          isDeleted: false,
          NOT: { id: scheduleId },
        },
        select: { id: true },
      });
      for (const sib of siblings) {
        await this.mergeJsonColumn(
          'departmentConsents',
          sib.id,
          departmentId,
          consentObj,
        );
      }
    }

    return this.findOne(scheduleId);
  }

  /**
   * Records that one attendee confirmed their attendance, without touching any other field -
   * in particular it never re-triggers the "an edit sends the record back to DRAFT" rule that
   * the generic `update()` below applies, since confirming attendance is not editing content.
   */
  async confirmAttendee(
    scheduleId: string,
    attendeeName: string,
    confirmedBy: string,
  ): Promise<any> {
    const s = await this.findOne(scheduleId);
    if (!s) throw new NotFoundException('Execution Schedule not found');

    await this.mergeJsonColumn(
      'attendeeConfirmations',
      scheduleId,
      attendeeName,
      {
        confirmedAt: new Date().toISOString(),
        confirmedBy,
      },
    );
    return this.findOne(scheduleId);
  }

  /**
   * Merges only the corrective-action fields of ONE finding row, identified by its stable
   * `id` (see backfillRowIds) rather than array index - the field whitelist here (see
   * ResolveFindingRowDto) is what lets `execution-schedules:resolve-finding` be granted
   * without `execution-schedules:update`: a caller with only the former can never reach any
   * other row, or any other field of this row, through this method.
   *
   * Unlike departmentConsents/attendeeConfirmations, `scheduleRows` is a JSON-stringified
   * ARRAY in a plain String column, not a keyed map - so there's no jsonb_set-on-a-key to
   * reach for here, and this is a read-modify-write like the generic `update()` below. When
   * `expectedUpdatedAt` is given, the write is a compare-and-swap so a genuine concurrent
   * conflict is rejected (409) rather than one side's change silently vanishing.
   */
  async resolveFindingRow(
    scheduleId: string,
    rowId: string,
    patch: ResolveFindingRowInput,
    actorName: string,
  ): Promise<any> {
    const target = await this.prisma.executionSchedule.findUnique({
      where: { id: scheduleId },
      select: { scheduleRows: true, isDeleted: true },
    });
    if (!target || target.isDeleted) {
      throw new NotFoundException('Execution Schedule not found');
    }

    let rows: any[];
    try {
      rows = JSON.parse(target.scheduleRows || '[]');
    } catch {
      rows = [];
    }
    const index = Array.isArray(rows)
      ? rows.findIndex((r) => r?.id === rowId)
      : -1;
    if (index === -1) {
      throw new NotFoundException(
        "Finding row not found - if this report hasn't been saved since row-level " +
          'resolving was added, ask an editor to open and save it once, then try again.',
      );
    }

    // Resolve is one-way here: the resolver can't undo it or re-stamp it with a new
    // user/time. Undoing is an editor action, done through the generic update().
    if (patch.resolve === false) {
      throw new BadRequestException(
        'A resolution can only be undone by a report editor.',
      );
    }
    if (patch.resolve === true && rows[index].correctiveFinalUser) {
      throw new ConflictException(
        `This finding row was already resolved by ${rows[index].correctiveFinalUser}.`,
      );
    }

    const row = { ...rows[index] };
    if (patch.correctiveFinalDate !== undefined)
      row.correctiveFinalDate = patch.correctiveFinalDate;
    if (patch.correctiveFinalRemarks !== undefined)
      row.correctiveFinalRemarks = patch.correctiveFinalRemarks;
    if (patch.attachments !== undefined) row.attachments = patch.attachments;
    if (patch.resolve === true) {
      row.correctiveFinalUser = actorName;
      row.correctiveFinalDatetime = new Date().toISOString();
    }
    rows[index] = row;
    const scheduleRows = JSON.stringify(rows);

    if (patch.expectedUpdatedAt !== undefined) {
      const { count } = await this.prisma.executionSchedule.updateMany({
        where: { id: scheduleId, updatedAt: new Date(patch.expectedUpdatedAt) },
        data: { scheduleRows, lastModifiedBy: actorName },
      });
      if (count === 0) throw new ConflictException(CONFLICT_MESSAGE);
    } else {
      await this.prisma.executionSchedule.update({
        where: { id: scheduleId },
        data: { scheduleRows, lastModifiedBy: actorName },
      });
    }

    return this.findOne(scheduleId);
  }

  /**
   * dbService.updateExecutionSchedule (dbService.ts:1464-1518).
   * NOTE: the source's return shape here deliberately omits qrToken/
   * departmentConsents (unlike findAll/create/findOne) - preserved as-is for parity
   * rather than "fixed", since other code may already depend on this exact shape.
   *
   * When `expectedUpdatedAt` is given, the write is a compare-and-swap: it only lands if
   * nobody has touched the schedule since that timestamp. This is what protects scheduleRows -
   * an ordered list, not a keyed map, so there's no per-field atomic merge to reach for the
   * way there is above - from two people's edits silently overwriting one another; the second
   * save is refused instead of quietly winning, so the loser can reload and re-apply their
   * change to the current version rather than lose it without ever knowing.
   */
  async update(
    id: string,
    data: UpdateExecutionScheduleInput,
    actorName: string,
  ): Promise<any> {
    // A soft-deleted schedule is not found, full stop - a plain edit must never resurrect its
    // content by writing to a row that's supposed to be gone.
    const target = await this.prisma.executionSchedule.findUnique({
      where: { id },
      select: { isDeleted: true },
    });
    if (!target || target.isDeleted) {
      throw new NotFoundException('Execution Schedule not found');
    }

    // ownerName is set once at creation and never changes; lastModifiedBy is the authenticated editor.
    const {
      attendeeConfirmations,
      expectedUpdatedAt,
      objectives,
      scope,
      ...updateData
    } = data;
    delete updateData.ownerName;
    if (updateData.scheduleRows !== undefined) {
      updateData.scheduleRows = this.backfillRowIds(updateData.scheduleRows);
    }

    if (expectedUpdatedAt !== undefined) {
      const { count } = await this.prisma.executionSchedule.updateMany({
        where: { id, updatedAt: new Date(expectedUpdatedAt) },
        data: { ...updateData, lastModifiedBy: actorName },
      });
      if (count === 0) {
        const exists = await this.prisma.executionSchedule.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!exists)
          throw new NotFoundException('Execution Schedule not found');
        throw new ConflictException(CONFLICT_MESSAGE);
      }
    }

    const s = await (expectedUpdatedAt !== undefined
      ? this.prisma.executionSchedule.findUniqueOrThrow({
          where: { id },
          include: { oePlan: true },
        })
      : this.prisma.executionSchedule.update({
          where: { id },
          data: { ...updateData, lastModifiedBy: actorName },
          include: { oePlan: true },
        }));
    await Promise.all([
      this.updateScheduleAttendeeConfirmations(s.id, attendeeConfirmations),
      this.planItems.writeList(
        PLAN_ITEM_OWNER.SCHEDULE_OBJECTIVE.type,
        id,
        objectives,
        PLAN_ITEM_OWNER.SCHEDULE_OBJECTIVE.prefix,
      ),
      this.planItems.writeList(
        PLAN_ITEM_OWNER.SCHEDULE_SCOPE.type,
        id,
        scope,
        PLAN_ITEM_OWNER.SCHEDULE_SCOPE.prefix,
      ),
    ]);
    // Re-read rather than trust `objectives`/`scope` directly: this may be a partial update
    // that didn't touch them, and they must still reflect their current, unchanged value.
    const [finalObjectives, finalScope] = await Promise.all([
      this.planItems.readOne(PLAN_ITEM_OWNER.SCHEDULE_OBJECTIVE.type, id),
      this.planItems.readOne(PLAN_ITEM_OWNER.SCHEDULE_SCOPE.type, id),
    ]);
    return {
      id: s.id,
      projectId: s.oePlanId,
      projectName: s.oePlan.name,
      projectCode: s.oePlan.code,
      departments: s.departments,
      address: s.address,
      visitNumber: s.visitNumber,
      actualVisitDate: s.actualVisitDate,
      oePeriod: s.oePeriod,
      leadExecution: s.leadExecution,
      teamMembers: s.teamMembers,
      additionalAttendees: s.additionalAttendees,
      attendeeConfirmations:
        attendeeConfirmations ?? s.attendeeConfirmations ?? '{}',
      standards: s.standards,
      language: s.language,
      status: s.status,
      objectives: finalObjectives,
      scope: finalScope,
      scheduleRows: s.scheduleRows,
      ownerName: s.ownerName,
      lastModifiedBy: s.lastModifiedBy,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  /**
   * Soft delete: hard-deleting used to cascade-destroy this schedule's Findings (real audit
   * records) with no undo. `isDeleted` rows are excluded from findAll() and treated as
   * not-found everywhere else in this service - nothing is actually removed from the database.
   */
  async remove(id: string): Promise<boolean> {
    const { count } = await this.prisma.executionSchedule.updateMany({
      where: { id, isDeleted: false },
      data: { isDeleted: true },
    });
    return count > 0;
  }
}
