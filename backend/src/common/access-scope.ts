import type { Prisma } from '../generated/prisma/client';
import type { AccessScope } from './permissions';

/**
 * Pure translation of "how far does this grant reach?" into database filters. No database or
 * framework code lives here so every rule can be unit-tested.
 *
 * Everything hangs off one chain: Annual Plan -> Project (ONE department, whose department
 * belongs to ONE Business Unit) -> OE Plan -> meetings / schedules -> findings.
 */
export interface ViewerContext {
  id: string;
  name: string;
  departmentId: string | null;
  businessUnitId: string | null;
}

/** Matches no rows at all: what a scope resolves to when the viewer lacks what it needs. */
const NOTHING = { id: { in: [] as string[] } };

export function projectWhere(
  scope: AccessScope,
  ctx: ViewerContext,
): Prisma.ProjectWhereInput {
  switch (scope) {
    case 'ALL':
      return {};
    case 'BU':
      return ctx.businessUnitId
        ? { department: { businessUnitId: ctx.businessUnitId } }
        : NOTHING;
    case 'DEPARTMENT':
      return ctx.departmentId ? { departmentId: ctx.departmentId } : NOTHING;
    default:
      // MEMBER is not offered for Projects; anything else sees nothing.
      return NOTHING;
  }
}

export function oePlanWhere(
  scope: AccessScope,
  ctx: ViewerContext,
): Prisma.OePlanWhereInput {
  switch (scope) {
    case 'ALL':
      return {};
    case 'BU':
      return ctx.businessUnitId
        ? {
            project: {
              department: { businessUnitId: ctx.businessUnitId },
            },
          }
        : NOTHING;
    case 'DEPARTMENT':
      return ctx.departmentId
        ? { project: { departmentId: ctx.departmentId } }
        : NOTHING;
    case 'MEMBER':
      return {
        OR: [
          { leaderId: ctx.id },
          { leaderId: ctx.name },
          { members: { some: { id: ctx.id } } },
        ],
      };
    default:
      return NOTHING;
  }
}

/**
 * An Annual Plan is visible when any of its Projects is inside the scope, or when the viewer
 * created it (so a plan you just made does not vanish while it has no Projects yet).
 */
export function annualPlanWhere(
  scope: AccessScope,
  ctx: ViewerContext,
): Prisma.AnnualPlanWhereInput {
  if (scope === 'ALL') return {};
  return {
    OR: [
      { createdBy: ctx.name },
      { projects: { some: projectWhere(scope, ctx) } },
    ],
  };
}

/** Whether a Project of this department falls inside the scope (used before creating/moving one). */
export function departmentInScope(
  scope: AccessScope,
  ctx: ViewerContext,
  department: { id: string; businessUnitId: string | null },
): boolean {
  switch (scope) {
    case 'ALL':
      return true;
    case 'BU':
      return (
        !!ctx.businessUnitId && department.businessUnitId === ctx.businessUnitId
      );
    case 'DEPARTMENT':
      return !!ctx.departmentId && department.id === ctx.departmentId;
    default:
      return false;
  }
}

export function meetingWhere(
  scope: AccessScope,
  ctx: ViewerContext,
): Prisma.OpenMeetingWhereInput {
  return scope === 'ALL' ? {} : { oePlan: oePlanWhere(scope, ctx) };
}

export function scheduleWhere(
  scope: AccessScope,
  ctx: ViewerContext,
): Prisma.ExecutionScheduleWhereInput {
  return scope === 'ALL' ? {} : { oePlan: oePlanWhere(scope, ctx) };
}

export function findingWhere(
  scope: AccessScope,
  ctx: ViewerContext,
): Prisma.FindingWhereInput {
  return scope === 'ALL'
    ? {}
    : { executionSchedule: { oePlan: oePlanWhere(scope, ctx) } };
}
