import { Injectable } from '@nestjs/common';
import {
  parsePlanItems,
  parseScopeOverride,
  serializePlanItems,
} from '@oeportal/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Every field backed by a PlanItem row, tagged with the `ownerType` string that groups its rows
 * and the id prefix used when an item has none of its own (legacy plain-text values, or a
 * brand-new item). Shared by every service that owns one of these fields and by the one-off
 * backfill script (prisma/backfill-plan-items.ts), so the tag/prefix for a given field is
 * defined exactly once.
 */
export const PLAN_ITEM_OWNER = {
  PROJECT_OBJECTIVE: { type: 'PROJECT_OBJECTIVE', prefix: 'OE-OBJ' },
  PROJECT_SCOPE: { type: 'PROJECT_SCOPE', prefix: 'OE-SCP' },
  OEPLAN_OBJECTIVE: { type: 'OEPLAN_OBJECTIVE', prefix: 'OE-OBJ' },
  OEPLAN_DATA_REQUEST: { type: 'OEPLAN_DATA_REQUEST', prefix: 'OE-DRQ' },
  OEPLAN_SCOPE_EXTRA: { type: 'OEPLAN_SCOPE_EXTRA', prefix: 'OE-SCP' },
  SCHEDULE_OBJECTIVE: { type: 'SCHEDULE_OBJECTIVE', prefix: 'IOE-OBJ' },
  SCHEDULE_SCOPE: { type: 'SCHEDULE_SCOPE', prefix: 'IOE-SCP' },
  MEETING_OBJECTIVE: { type: 'MEETING_OBJECTIVE', prefix: 'IOE-OBJ' },
  MEETING_SCOPE: { type: 'MEETING_SCOPE', prefix: 'IOE-SCP' },
} as const;

/**
 * Backs the objectives/scope/data-request "line item" lists that used to be a JSON-encoded
 * array in a single String column (Project.objectives/scope, OePlan.objectives/dataRequestType,
 * ExecutionSchedule.objectives/scope, OpenMeeting.objectives/scope - see the TODO(plan-items)
 * markers on those models) - now real PlanItem rows. The wire format is unchanged: every DTO
 * still accepts/returns the same JSON string it always did; this service is the only place that
 * translates between that string and the rows underneath, reusing the exact parsing logic the
 * frontend has always used (@oeportal/shared) so a value round-trips identically either way.
 *
 * `ownerType` (see PLAN_ITEM_OWNER above) is a plain string tag distinguishing which field a row
 * belongs to. There is deliberately no enum: this is internal bookkeeping, never seen on the wire.
 */
@Injectable()
export class PlanItemsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Replaces one owner's items wholesale. `raw === undefined` is a no-op (a partial update that
   * omits this field leaves existing rows untouched, same as the opExTimeline/approvals
   * pattern); `raw === ''` (or otherwise content-free) clears them to zero rows - parsePlanItems
   * always returns one blank placeholder item for "nothing here yet", which is a display
   * convenience, not real content, so it is filtered out before storing.
   */
  async writeList(
    ownerType: string,
    ownerId: string,
    raw: string | undefined,
    prefix: string,
  ): Promise<void> {
    if (raw === undefined) return;
    const items = parsePlanItems(raw, prefix).filter(
      (item) => item.text.trim() !== '',
    );
    await this.prisma.$transaction([
      this.prisma.planItem.deleteMany({ where: { ownerType, ownerId } }),
      ...(items.length
        ? [
            this.prisma.planItem.createMany({
              data: items.map((item, index) => ({
                ownerType,
                ownerId,
                itemId: item.id,
                text: item.text,
                order: index,
              })),
            }),
          ]
        : []),
    ]);
  }

  /** Wire-format JSON string (`[{id,text},...]`) for a single owner. */
  async readOne(ownerType: string, ownerId: string): Promise<string> {
    return (await this.readMany(ownerType, [ownerId])).get(ownerId) ?? '[]';
  }

  /**
   * Batched read for list views: one query for every owner instead of one query per owner, so
   * e.g. GET /oe-plans doesn't turn into a query per plan (and per schedule, per meeting...) -
   * this DB is remote, so round trips are the expensive part. Every id in `ownerIds` is present
   * in the result, defaulting to an empty list.
   */
  async readMany(
    ownerType: string,
    ownerIds: string[],
  ): Promise<Map<string, string>> {
    if (ownerIds.length === 0) return new Map();
    const rows = await this.prisma.planItem.findMany({
      where: { ownerType, ownerId: { in: ownerIds } },
      orderBy: { order: 'asc' },
    });
    const grouped = new Map<string, { id: string; text: string }[]>();
    for (const r of rows) {
      const list = grouped.get(r.ownerId) ?? [];
      list.push({ id: r.itemId, text: r.text });
      grouped.set(r.ownerId, list);
    }
    return new Map(
      ownerIds.map((id) => [id, JSON.stringify(grouped.get(id) ?? [])]),
    );
  }

  // --- OePlan.scope only: a { inactiveIds, extraItems } diff on top of the linked Project's
  // scope, not a plain item list (see resolveEffectiveScopeItems in @oeportal/shared). The
  // inactive-ids half is a plain column (OePlan.inactiveScopeItemIds); the extra-items half is
  // ordinary PlanItem rows under the OEPLAN_SCOPE_EXTRA owner type.

  /** Splits an incoming wire `scope` value into its two storage halves. `undefined` in for both
   * halves out, matching writeList's no-op-on-undefined partial-update semantics. */
  parseScopeOverrideInput(raw: string | undefined): {
    inactiveScopeItemIds: string[] | undefined;
    extraItemsRaw: string | undefined;
  } {
    if (raw === undefined) {
      return { inactiveScopeItemIds: undefined, extraItemsRaw: undefined };
    }
    const override = parseScopeOverride(raw);
    return {
      inactiveScopeItemIds: override.inactiveIds,
      extraItemsRaw: serializePlanItems(override.extraItems),
    };
  }

  async writeScopeExtraItems(
    oePlanId: string,
    extraItemsRaw: string | undefined,
  ): Promise<void> {
    const { type, prefix } = PLAN_ITEM_OWNER.OEPLAN_SCOPE_EXTRA;
    return this.writeList(type, oePlanId, extraItemsRaw, prefix);
  }

  async readScopeOverride(
    oePlanId: string,
    inactiveScopeItemIds: string[],
  ): Promise<string> {
    const extraItemsJson = await this.readOne(
      PLAN_ITEM_OWNER.OEPLAN_SCOPE_EXTRA.type,
      oePlanId,
    );
    return JSON.stringify({
      inactiveIds: inactiveScopeItemIds,
      extraItems: JSON.parse(extraItemsJson) as unknown,
    });
  }

  /** Batched form of readScopeOverride, for list views. */
  async readScopeOverrideMany(
    oePlanIds: string[],
    inactiveByOwnerId: ReadonlyMap<string, string[]>,
  ): Promise<Map<string, string>> {
    const extraItemsMap = await this.readMany(
      PLAN_ITEM_OWNER.OEPLAN_SCOPE_EXTRA.type,
      oePlanIds,
    );
    return new Map(
      oePlanIds.map((id) => [
        id,
        JSON.stringify({
          inactiveIds: inactiveByOwnerId.get(id) ?? [],
          extraItems: JSON.parse(extraItemsMap.get(id) ?? '[]') as unknown,
        }),
      ]),
    );
  }
}
