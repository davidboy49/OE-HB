import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { assertOePlanReleased } from '../common/assert-oe-plan-status';

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
  constructor(private readonly prisma: PrismaService) {}

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
  private toDto(s: any, attendeeConfirmationsOverride?: string): any {
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
      objectives: s.objectives,
      scope: s.scope,
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
      where,
      include: { oePlan: true },
      orderBy: { createdAt: 'desc' },
    });
    const confirmationMap = await this.getScheduleAttendeeConfirmations(
      schedules.map((s) => s.id),
    );
    return schedules.map((s) => this.toDto(s, confirmationMap[s.id]));
  }

  /** The owner is always the authenticated creator (actorName), never a client-supplied value. */
  async create(
    data: CreateExecutionScheduleInput,
    actorName: string,
  ): Promise<any> {
    await assertOePlanReleased(this.prisma, data.projectId);

    const { attendeeConfirmations, projectId, ...createData } = data;
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
    await this.updateScheduleAttendeeConfirmations(s.id, attendeeConfirmations);
    return this.toDto(s, attendeeConfirmations);
  }

  async findOne(id: string): Promise<any | null> {
    const s = await this.prisma.executionSchedule.findUnique({
      where: { id },
      include: { oePlan: true },
    });
    if (!s) return null;
    const confirmationMap = await this.getScheduleAttendeeConfirmations([id]);
    return this.toDto(s, confirmationMap[s.id]);
  }

  /**
   * dbService.updateDepartmentConsent (dbService.ts:1422-1463). Records a single
   * department's consent decision and fans it out to sibling schedules on the same OE Plan.
   */
  async updateDepartmentConsent(
    scheduleId: string,
    departmentId: string,
    consentObj: DepartmentConsentInput,
  ): Promise<any> {
    const s = await this.prisma.executionSchedule.findUnique({
      where: { id: scheduleId },
    });
    if (!s) throw new NotFoundException('Execution Schedule not found');

    let consents: Record<string, any> = {};
    try {
      consents = JSON.parse(s.departmentConsents || '{}');
    } catch {
      consents = {};
    }
    consents[departmentId] = consentObj;

    const updated = await this.prisma.executionSchedule.update({
      where: { id: scheduleId },
      data: { departmentConsents: JSON.stringify(consents) },
      include: { oePlan: true },
    });

    if (s.oePlanId) {
      const siblingSchedules = await this.prisma.executionSchedule.findMany({
        where: { oePlanId: s.oePlanId, NOT: { id: scheduleId } },
      });
      for (const sib of siblingSchedules) {
        let sibConsents: Record<string, any> = {};
        try {
          sibConsents = JSON.parse(sib.departmentConsents || '{}');
        } catch {
          sibConsents = {};
        }
        sibConsents[departmentId] = consentObj;
        await this.prisma.executionSchedule.update({
          where: { id: sib.id },
          data: { departmentConsents: JSON.stringify(sibConsents) },
        });
      }
    }

    return {
      ...updated,
      projectName: updated.oePlan?.name,
      projectCode: updated.oePlan?.code,
    };
  }

  /**
   * dbService.updateExecutionSchedule (dbService.ts:1464-1518).
   * NOTE: the source's return shape here deliberately omits qrToken/
   * departmentConsents (unlike findAll/create/findOne) - preserved as-is for parity
   * rather than "fixed", since other code may already depend on this exact shape.
   */
  async update(
    id: string,
    data: UpdateExecutionScheduleInput,
    actorName: string,
  ): Promise<any> {
    // ownerName is set once at creation and never changes; lastModifiedBy is the authenticated editor.
    const { attendeeConfirmations, ...updateData } = data;
    delete updateData.ownerName;
    const s = await this.prisma.executionSchedule.update({
      where: { id },
      data: { ...updateData, lastModifiedBy: actorName },
      include: { oePlan: true },
    });
    await this.updateScheduleAttendeeConfirmations(s.id, attendeeConfirmations);
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
      objectives: s.objectives,
      scope: s.scope,
      scheduleRows: s.scheduleRows,
      ownerName: s.ownerName,
      lastModifiedBy: s.lastModifiedBy,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  async remove(id: string): Promise<boolean> {
    await this.prisma.executionSchedule.delete({ where: { id } });
    return true;
  }
}
