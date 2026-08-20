import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { assertProjectReleased } from '../common/assert-project-status';
import {
  ExecutionSchedulesService,
  DepartmentConsentInput,
} from '../execution-schedules/execution-schedules.service';

export interface CreateOpenMeetingInput {
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
  status?: string;
  objectives: string;
  scope: string;
  departmentConcern?: string;
  scheduleRows: string;
  attachments?: string;
  ownerName?: string;
  lastModifiedBy?: string;
  qrToken?: string;
  departmentConsents?: string;
}

export interface UpdateOpenMeetingInput {
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
  status?: string;
  objectives?: string;
  scope?: string;
  departmentConcern?: string;
  scheduleRows?: string;
  attachments?: string;
  ownerName?: string;
  lastModifiedBy?: string;
}

/**
 * Port of the OpenMeeting + QR consent slice of frontend/src/lib/dbService.ts
 * (lines 925-1337) + frontend/src/app/actions.ts (lines 382-409, 823-847).
 */
@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly executionSchedulesService: ExecutionSchedulesService,
  ) {}

  private toDto(m: any): any {
    return {
      id: m.id,
      projectId: m.projectId,
      projectName: m.project?.name,
      projectCode: m.project?.code,
      departments: m.departments,
      address: m.address,
      visitNumber: m.visitNumber,
      actualVisitDate: m.actualVisitDate,
      auditPeriod: m.auditPeriod,
      leadExecution: m.leadExecution,
      teamMembers: m.teamMembers,
      additionalAttendees: m.additionalAttendees,
      attendeeConfirmations: m.attendeeConfirmations,
      standards: m.standards,
      status: m.status,
      objectives: m.objectives,
      scope: m.scope,
      departmentConcern: m.departmentConcern,
      scheduleRows: m.scheduleRows,
      attachments: m.attachments,
      ownerName: m.ownerName,
      lastModifiedBy: m.lastModifiedBy,
      qrToken: m.qrToken,
      departmentConsents: m.departmentConsents,
      isDeleted: m.isDeleted,
      createdAt:
        m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
      updatedAt:
        m.updatedAt instanceof Date ? m.updatedAt.toISOString() : m.updatedAt,
    };
  }

  /**
   * dbService.ensureOpenMeetingsForProject (dbService.ts:925-1011). Auto-creates a
   * default OpenMeeting (with a standard 3-slot opening agenda) for every department
   * on a project that doesn't already have one. Public - AuditProjectsModule injects
   * MeetingsService and calls this from its own update()/release flow.
   */
  async ensureOpenMeetingsForProject(projectId: string): Promise<any[]> {
    const project = await this.prisma.auditProject.findUnique({
      where: { id: projectId },
    });
    if (!project) return [];

    const deptsRaw = project.departments || '';
    let deptList = deptsRaw
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);
    if (deptList.length === 0) {
      deptList = ['IT', 'Finance', 'Operations'];
      await this.prisma.auditProject.update({
        where: { id: projectId },
        data: { departments: deptList.join(', ') },
      });
    }

    const startDateStr = project.startDate
      ? project.startDate.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    const openMeetingsInDb = await this.prisma.openMeeting.findMany({
      where: { projectId },
    });

    const createdMeetings: any[] = [];

    for (const dept of deptList) {
      const exists = openMeetingsInDb.some(
        (m) =>
          m.departments &&
          (m.departments === dept ||
            m.departments
              .split(',')
              .map((d) => d.trim())
              .includes(dept)),
      );

      if (!exists) {
        const defaultAgendaRows = [
          {
            day: 'Day 1',
            date: startDateStr,
            time: '09:00 AM - 09:30 AM',
            activity: `Opening Meeting & Audit Scope Briefing for ${dept}`,
            conductBy: project.auditorNames || 'Lead Auditor',
            pIncharge: dept,
          },
          {
            day: 'Day 1',
            date: startDateStr,
            time: '09:30 AM - 10:30 AM',
            activity: `Scope Alignment & Data Request Discussion for ${dept}`,
            conductBy: project.auditorNames || 'Audit Team',
            pIncharge: dept,
          },
          {
            day: 'Day 1',
            date: startDateStr,
            time: '10:30 AM - 11:00 AM',
            activity: `Scope Consent & Attendance Confirmation for ${dept}`,
            conductBy: project.auditorNames || 'Audit Team',
            pIncharge: dept,
          },
        ];

        const newMeeting = await this.prisma.openMeeting.create({
          data: {
            projectId: project.id,
            departments: dept,
            address: 'HQ Main Conference Room / Virtual Meeting',
            visitNumber: '01',
            actualVisitDate: startDateStr,
            auditPeriod: `${project.startDate ? new Date(project.startDate).toLocaleDateString('en-GB') : 'Start'} - ${project.endDate ? new Date(project.endDate).toLocaleDateString('en-GB') : 'End'}`,
            leadExecution: project.auditorNames || 'Lead Auditor',
            teamMembers: project.auditorNames || '',
            additionalAttendees: project.deptPicIds || '',
            attendeeConfirmations: '{}',
            standards: 'Work Procedure, Work Instruction & Policy',
            status: 'DRAFT',
            objectives:
              project.objectives ||
              `Evaluate operational compliance and risk management for ${dept}.`,
            scope:
              project.scope ||
              `Full scope audit covering departmental procedures and key controls for ${dept}.`,
            scheduleRows: JSON.stringify(defaultAgendaRows),
            attachments: '[]',
            ownerName: 'Sarah Jenkins',
            lastModifiedBy: 'Sarah Jenkins',
            qrToken: project.id,
            departmentConsents: '{}',
          },
        });
        createdMeetings.push(newMeeting);
        openMeetingsInDb.push(newMeeting);
      }
    }

    return createdMeetings;
  }

  async findAll(): Promise<any[]> {
    const meetings = await this.prisma.openMeeting.findMany({
      where: { isDeleted: false },
      include: { project: true },
      orderBy: { createdAt: 'desc' },
    });
    return meetings.map((m) => this.toDto(m));
  }

  async findByProject(projectId: string): Promise<any[]> {
    const meetings = await this.prisma.openMeeting.findMany({
      where: { projectId, isDeleted: false },
      include: { project: true },
      orderBy: { createdAt: 'asc' },
    });
    return meetings.map((m) => this.toDto(m));
  }

  async findOne(id: string): Promise<any | null> {
    const m = await this.prisma.openMeeting.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!m || m.isDeleted) return null;
    return this.toDto(m);
  }

  async create(data: CreateOpenMeetingInput): Promise<any> {
    await assertProjectReleased(this.prisma, data.projectId);
    const m = await this.prisma.openMeeting.create({
      data: {
        projectId: data.projectId,
        departments: data.departments,
        address: data.address,
        visitNumber: data.visitNumber,
        actualVisitDate: data.actualVisitDate,
        auditPeriod: data.auditPeriod,
        leadExecution: data.leadExecution,
        teamMembers: data.teamMembers,
        additionalAttendees: data.additionalAttendees,
        attendeeConfirmations: data.attendeeConfirmations || '{}',
        standards: data.standards,
        status: data.status || 'DRAFT',
        objectives: data.objectives,
        scope: data.scope,
        departmentConcern: data.departmentConcern || '',
        scheduleRows: data.scheduleRows,
        attachments: data.attachments || '[]',
        ownerName: data.ownerName || 'Sarah Jenkins',
        lastModifiedBy: data.lastModifiedBy || 'Sarah Jenkins',
        qrToken: data.qrToken || data.projectId,
        departmentConsents: data.departmentConsents || '{}',
      },
      include: { project: true },
    });
    return this.findOne(m.id);
  }

  async update(id: string, data: UpdateOpenMeetingInput): Promise<any> {
    const updateData: Prisma.OpenMeetingUpdateInput = {
      departments: data.departments,
      address: data.address,
      visitNumber: data.visitNumber,
      actualVisitDate: data.actualVisitDate,
      auditPeriod: data.auditPeriod,
      leadExecution: data.leadExecution,
      teamMembers: data.teamMembers,
      additionalAttendees: data.additionalAttendees,
      attendeeConfirmations: data.attendeeConfirmations,
      standards: data.standards,
      status: data.status,
      objectives: data.objectives,
      scope: data.scope,
      departmentConcern: data.departmentConcern,
      scheduleRows: data.scheduleRows,
      attachments: data.attachments,
      ownerName: data.ownerName,
      lastModifiedBy: data.lastModifiedBy,
    };

    const m = await this.prisma.openMeeting.update({
      where: { id },
      data: updateData,
      include: { project: true },
    });
    return this.findOne(m.id);
  }

  async remove(id: string): Promise<boolean> {
    await this.prisma.openMeeting.update({
      where: { id },
      data: { isDeleted: true },
    });
    return true;
  }

  /**
   * dbService.getOpenMeetingByQrToken (dbService.ts:1194-1292). Resolves by qrToken, id,
   * projectId or project code; auto-provisions OpenMeetings for a matching project if
   * needed; merges departments/consents across sibling OpenMeetings; and falls back to
   * the ExecutionSchedule QR lookup when nothing matches (single-department schedules
   * created outside the OpenMeeting flow).
   */
  async findByQrToken(qrToken: string): Promise<any | null> {
    let m = await this.prisma.openMeeting.findFirst({
      where: {
        isDeleted: false,
        OR: [
          { qrToken },
          { id: qrToken },
          { projectId: qrToken },
          { project: { code: qrToken } },
        ],
      },
      include: { project: true },
    });

    if (!m) {
      const matchingProject = await this.prisma.auditProject.findFirst({
        where: { OR: [{ code: qrToken }, { id: qrToken }] },
      });
      if (matchingProject) {
        await this.ensureOpenMeetingsForProject(matchingProject.id);
        m = await this.prisma.openMeeting.findFirst({
          where: { projectId: matchingProject.id, isDeleted: false },
          include: { project: true },
        });
      }
      if (!m) {
        return this.executionSchedulesService.findByQrToken(qrToken);
      }
    }

    let mergedDepartments = m.departments;
    let mergedConsents: Record<string, any> = {};
    try {
      mergedConsents = JSON.parse(m.departmentConsents || '{}');
    } catch {
      mergedConsents = {};
    }

    if (m.projectId) {
      const siblingMeetings = await this.prisma.openMeeting.findMany({
        where: { projectId: m.projectId },
      });

      if (m.project?.departments) {
        mergedDepartments = m.project.departments;
      } else {
        const deptSet = new Set<string>();
        siblingMeetings.forEach((sib) => {
          (sib.departments || '').split(',').forEach((d) => {
            const clean = d.trim();
            if (clean) deptSet.add(clean);
          });
        });
        if (deptSet.size > 0)
          mergedDepartments = Array.from(deptSet).join(', ');
      }

      for (const sib of siblingMeetings) {
        try {
          const sibConsents = JSON.parse(sib.departmentConsents || '{}');
          Object.assign(mergedConsents, sibConsents);
        } catch {
          // ignore invalid json
        }
      }
    }

    return {
      id: m.id,
      projectId: m.projectId,
      projectName: m.project?.name,
      projectCode: m.project?.code,
      departments: mergedDepartments,
      address: m.address,
      visitNumber: m.visitNumber,
      actualVisitDate: m.actualVisitDate,
      auditPeriod: m.auditPeriod,
      leadExecution: m.leadExecution,
      teamMembers: m.teamMembers,
      additionalAttendees: m.additionalAttendees,
      attendeeConfirmations: m.attendeeConfirmations ?? '{}',
      standards: m.standards,
      status: m.status,
      objectives: m.objectives,
      scope: m.scope,
      scheduleRows: m.scheduleRows,
      attachments: m.attachments,
      ownerName: m.ownerName,
      lastModifiedBy: m.lastModifiedBy,
      qrToken: m.qrToken ?? m.id,
      departmentConsents: JSON.stringify(mergedConsents),
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }

  /**
   * dbService.updateOpenMeetingDepartmentConsent (dbService.ts:1294-1337). Falls back to
   * ExecutionSchedulesService.updateDepartmentConsent when `meetingId` isn't an OpenMeeting
   * (e.g. it resolved to an ExecutionSchedule id via the QR fallback above).
   */
  async updateDepartmentConsent(
    meetingId: string,
    departmentId: string,
    consentObj: DepartmentConsentInput,
  ): Promise<any> {
    const m = await this.prisma.openMeeting.findUnique({
      where: { id: meetingId },
    });
    if (!m) {
      return this.executionSchedulesService.updateDepartmentConsent(
        meetingId,
        departmentId,
        consentObj,
      );
    }

    let consents: Record<string, any> = {};
    try {
      consents = JSON.parse(m.departmentConsents || '{}');
    } catch {
      consents = {};
    }
    consents[departmentId] = consentObj;

    const updated = await this.prisma.openMeeting.update({
      where: { id: meetingId },
      data: { departmentConsents: JSON.stringify(consents) },
      include: { project: true },
    });

    if (m.projectId) {
      const siblingMeetings = await this.prisma.openMeeting.findMany({
        where: { projectId: m.projectId, NOT: { id: meetingId } },
      });
      for (const sib of siblingMeetings) {
        let sibConsents: Record<string, any> = {};
        try {
          sibConsents = JSON.parse(sib.departmentConsents || '{}');
        } catch {
          sibConsents = {};
        }
        sibConsents[departmentId] = consentObj;
        await this.prisma.openMeeting.update({
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
}
