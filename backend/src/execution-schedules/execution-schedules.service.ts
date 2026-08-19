import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';

export interface CreateExecutionScheduleInput {
  projectId: string;
  departments: string;
  address: string;
  visitNumber: string;
  actualVisitDate: string;
  auditPeriod: string;
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
  attachments?: string;
  ownerName?: string;
  lastModifiedBy?: string;
}

export interface UpdateExecutionScheduleInput {
  departments?: string;
  address?: string;
  visitNumber?: string;
  actualVisitDate?: string;
  auditPeriod?: string;
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
  attachments?: string;
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
}

/**
 * Port of the ExecutionSchedule slice of frontend/src/lib/dbService.ts
 * (lines 721-860 and 1339-1523) + frontend/src/app/actions.ts (lines 293-409).
 */
@Injectable()
export class ExecutionSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Mirrors dbService.assertProjectNotClosed (dbService.ts:29-35). */
  private async assertProjectNotClosed(projectId?: string): Promise<void> {
    if (!projectId) return;
    const proj = await this.prisma.auditProject.findUnique({
      where: { id: projectId },
    });
    if (proj && proj.status === 'CLOSED') {
      throw new Error(
        'This Audit Plan is CLOSED. No modifications or new records can be linked to a closed audit plan.',
      );
    }
  }

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

  /** Shared response shape used by findAll/create/findOne (dbService.ts:730-757, 795-822, 831-858). */
  private toDto(s: any, attendeeConfirmationsOverride?: string): any {
    return {
      id: s.id,
      projectId: s.projectId,
      projectName: s.project?.name,
      projectCode: s.project?.code,
      departments: s.departments,
      address: s.address,
      visitNumber: s.visitNumber,
      actualVisitDate: s.actualVisitDate,
      auditPeriod: s.auditPeriod,
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
      attachments: s.attachments,
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

  async findAll(): Promise<any[]> {
    const schedules = await this.prisma.executionSchedule.findMany({
      include: { project: true },
      orderBy: { createdAt: 'desc' },
    });
    const confirmationMap = await this.getScheduleAttendeeConfirmations(
      schedules.map((s) => s.id),
    );
    return schedules.map((s) => this.toDto(s, confirmationMap[s.id]));
  }

  async create(data: CreateExecutionScheduleInput): Promise<any> {
    await this.assertProjectNotClosed(data.projectId);

    const { attendeeConfirmations, ...createData } = data;
    const s = await this.prisma.executionSchedule.create({
      data: createData,
      include: { project: true },
    });
    await this.updateScheduleAttendeeConfirmations(s.id, attendeeConfirmations);
    return this.toDto(s, attendeeConfirmations);
  }

  async findOne(id: string): Promise<any | null> {
    const s = await this.prisma.executionSchedule.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!s) return null;
    const confirmationMap = await this.getScheduleAttendeeConfirmations([id]);
    return this.toDto(s, confirmationMap[s.id]);
  }

  /**
   * dbService.getExecutionScheduleByQrToken (dbService.ts:1339-1420). Resolves by qrToken,
   * id, projectId or project code, then merges departments/consents across sibling
   * schedules on the same project.
   */
  async findByQrToken(qrToken: string): Promise<any | null> {
    const s = await this.prisma.executionSchedule.findFirst({
      where: {
        OR: [
          { qrToken },
          { id: qrToken },
          { projectId: qrToken },
          { project: { code: qrToken } },
        ],
      },
      include: { project: true },
    });
    if (!s) return null;

    let mergedDepartments = s.departments;
    let mergedConsents: Record<string, any> = {};
    try {
      mergedConsents = JSON.parse(s.departmentConsents || '{}');
    } catch {
      mergedConsents = {};
    }

    if (s.projectId) {
      const siblingSchedules = await this.prisma.executionSchedule.findMany({
        where: { projectId: s.projectId },
      });

      if (s.project?.departments) {
        mergedDepartments = s.project.departments;
      } else {
        const deptSet = new Set<string>();
        siblingSchedules.forEach((sib) => {
          (sib.departments || '').split(',').forEach((d) => {
            const clean = d.trim();
            if (clean) deptSet.add(clean);
          });
        });
        if (deptSet.size > 0)
          mergedDepartments = Array.from(deptSet).join(', ');
      }

      for (const sib of siblingSchedules) {
        try {
          const sibConsents = JSON.parse(sib.departmentConsents || '{}');
          Object.assign(mergedConsents, sibConsents);
        } catch {
          // ignore invalid json
        }
      }
    }

    const confirmationMap = await this.getScheduleAttendeeConfirmations([s.id]);
    return {
      ...this.toDto(s, confirmationMap[s.id]),
      departments: mergedDepartments,
      departmentConsents: JSON.stringify(mergedConsents),
    };
  }

  /**
   * dbService.updateDepartmentConsent (dbService.ts:1422-1463). Records a single
   * department's consent decision and fans it out to sibling schedules on the same project.
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
      include: { project: true },
    });

    if (s.projectId) {
      const siblingSchedules = await this.prisma.executionSchedule.findMany({
        where: { projectId: s.projectId, NOT: { id: scheduleId } },
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
      projectName: updated.project?.name,
      projectCode: updated.project?.code,
    };
  }

  /**
   * dbService.updateExecutionSchedule (dbService.ts:1464-1518).
   * NOTE: the source's return shape here deliberately omits attachments/qrToken/
   * departmentConsents (unlike findAll/create/findOne) - preserved as-is for parity
   * rather than "fixed", since other code may already depend on this exact shape.
   */
  async update(id: string, data: UpdateExecutionScheduleInput): Promise<any> {
    const { attendeeConfirmations, ...updateData } = data;
    const s = await this.prisma.executionSchedule.update({
      where: { id },
      data: updateData,
      include: { project: true },
    });
    await this.updateScheduleAttendeeConfirmations(s.id, attendeeConfirmations);
    return {
      id: s.id,
      projectId: s.projectId,
      projectName: s.project.name,
      projectCode: s.project.code,
      departments: s.departments,
      address: s.address,
      visitNumber: s.visitNumber,
      actualVisitDate: s.actualVisitDate,
      auditPeriod: s.auditPeriod,
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
