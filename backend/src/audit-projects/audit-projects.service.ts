import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CodeGeneratorService } from '../code-generator/code-generator.service';
import { MeetingsService } from '../meetings/meetings.service';
import type { AuditProject } from '@auditdesk/shared';
import type { UpdateAuditProjectDto } from './dto/update-audit-project.dto';

/**
 * Ported from src/lib/dbService.ts (getProjects, createProject, updateProject,
 * deleteProject). The include/mapping shape logic below is copied as-is so the
 * returned object shape matches exactly what the frontend already expects.
 */
@Injectable()
export class AuditProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codeGenerator: CodeGeneratorService,
    private readonly meetingsService: MeetingsService,
  ) {}

  async findAll(): Promise<AuditProject[]> {
    const projects = await this.prisma.auditProject.findMany({
      include: {
        auditors: true,
        attachments: true,
        executionSchedules: {
          include: {
            findings: {
              include: {
                auditor: true,
              },
            },
          },
        },
        openMeetings: {
          where: { isDeleted: false },
        },
        auditPlan: true,
      },
      orderBy: { code: 'desc' },
      // This DB is remote (~200ms/round-trip); the default "query" strategy issues
      // one round trip per relation (~6 here). "join" fetches it all in one SQL
      // statement instead. Row counts here are small, so the join's duplicated-row
      // payload cost is negligible next to the round-trip savings.
      relationLoadStrategy: 'join',
    });
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      status: p.status as any,
      workflowStage: p.workflowStage as any,
      deptPicIds: p.deptPicIds,
      departments: p.auditPlan?.topic || p.departments,
      annualPlanId: p.annualPlanId || undefined,
      auditPlanId: p.auditPlanId || undefined,
      scope: p.scope,
      planningDetails: p.planningDetails,
      startDate: p.startDate.toISOString().split('T')[0],
      endDate: p.endDate.toISOString().split('T')[0],
      leadAuditorId: p.leadAuditorId,
      auditorNames: p.auditorNames,
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
      auditorIds: p.auditors.map((a) => a.id),
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
              auditorName: f.auditor?.name,
              createdAt: f.createdAt.toISOString(),
            })),
          )
        : [],
      executionSchedules: p.executionSchedules.map((e) => ({
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
        auditPeriod: m.auditPeriod,
        leadExecution: m.leadExecution,
        teamMembers: m.teamMembers,
        additionalAttendees: m.additionalAttendees,
        attendeeConfirmations: m.attendeeConfirmations,
        standards: m.standards,
        status: m.status as any,
        objectives: m.objectives,
        scope: m.scope,
        scheduleRows: m.scheduleRows,
        attachments: m.attachments,
        ownerName: m.ownerName,
        lastModifiedBy: m.lastModifiedBy,
        qrToken: m.qrToken,
        departmentConsents: m.departmentConsents,
      })),
      attachments: p.attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileSize: a.fileSize,
        fileType: a.fileType,
        fileData: a.fileData,
        projectId: a.projectId,
        createdAt: a.createdAt.toISOString(),
      })),
    }));
  }

  async create(
    name: string,
    code: string,
    status: string,
    scope: string,
    planningDetails: string,
    startDate: string,
    endDate: string,
    leadAuditorId: string | null,
    departments: string = '',
    annualPlanId: string | null = null,
    auditPlanId: string | null = null,
  ): Promise<AuditProject> {
    let normalizedCode = (code || '').trim().toUpperCase();

    if (!normalizedCode || normalizedCode === 'AUTO') {
      const startYear = startDate
        ? new Date(startDate).getFullYear()
        : new Date().getFullYear();
      normalizedCode = await this.codeGenerator.generateDocumentCode(
        'AP',
        startYear,
      );
    }

    const existing = await this.prisma.auditProject.findFirst({
      where: { code: normalizedCode },
    });
    if (existing) {
      throw new ConflictException(
        `An Audit Plan with code ${normalizedCode} already exists.`,
      );
    }

    const p = await this.prisma.auditProject.create({
      data: {
        name,
        code: normalizedCode,
        status,
        scope,
        planningDetails,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        leadAuditorId,
        auditorNames: '',
        workflowStage: 'DRAFTING',
        deptPicIds: '',
        departments,
        annualPlanId,
        auditPlanId,
        objectives: '',
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
        auditors: true,
        attachments: true,
        executionSchedules: {
          include: {
            findings: {
              include: {
                auditor: true,
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
      deptPicIds: p.deptPicIds,
      departments: p.departments,
      annualPlanId: p.annualPlanId || undefined,
      auditPlanId: p.auditPlanId || undefined,
      scope: p.scope,
      planningDetails: p.planningDetails,
      startDate: p.startDate.toISOString().split('T')[0],
      endDate: p.endDate.toISOString().split('T')[0],
      leadAuditorId: p.leadAuditorId,
      auditorNames: p.auditorNames,
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
      auditorIds: p.auditors.map((a) => a.id),
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
              auditorName: f.auditor?.name,
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
      attachments: [],
    };
  }

  async update(
    id: string,
    updates: UpdateAuditProjectDto,
  ): Promise<AuditProject | null> {
    let auditorConnections: { set: { id: string }[] } | undefined = undefined;
    if (updates.auditorIds) {
      const validUsers = await this.prisma.user.findMany({
        where: {
          OR: [
            { id: { in: updates.auditorIds } },
            { name: { in: updates.auditorIds } },
          ],
        },
      });
      auditorConnections = {
        set: validUsers.map((u) => ({ id: u.id })),
      };
    }

    const p = await this.prisma.auditProject.update({
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
        leadAuditorId: updates.leadAuditorId,
        auditorNames: updates.auditorNames,
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
        auditPlanId: updates.auditPlanId,
        auditors: auditorConnections,
      },
      include: {
        auditors: true,
        attachments: true,
        executionSchedules: {
          include: {
            findings: {
              include: {
                auditor: true,
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
    let finalOpenMeetings = p.openMeetings;

    if (updates.status === 'RELEASED') {
      try {
        await this.meetingsService.ensureOpenMeetingsForProject(id);
        finalOpenMeetings = await this.prisma.openMeeting.findMany({
          where: { projectId: id, isDeleted: false },
        });
      } catch (err) {
        console.error('Failed to auto-create open meetings on release:', err);
      }
    }

    return {
      id: p.id,
      name: p.name,
      code: p.code,
      status: p.status as any,
      workflowStage: p.workflowStage as any,
      deptPicIds: p.deptPicIds,
      departments: p.departments,
      annualPlanId: p.annualPlanId || undefined,
      auditPlanId: p.auditPlanId || undefined,
      scope: p.scope,
      planningDetails: p.planningDetails,
      startDate: p.startDate.toISOString().split('T')[0],
      endDate: p.endDate.toISOString().split('T')[0],
      leadAuditorId: p.leadAuditorId,
      auditorNames: p.auditorNames,
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
      auditorIds: p.auditors.map((a) => a.id),
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
              auditorName: f.auditor?.name,
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
        auditPeriod: m.auditPeriod,
        leadExecution: m.leadExecution,
        teamMembers: m.teamMembers,
        additionalAttendees: m.additionalAttendees,
        attendeeConfirmations: m.attendeeConfirmations,
        standards: m.standards,
        status: m.status as any,
        objectives: m.objectives,
        scope: m.scope,
        scheduleRows: m.scheduleRows,
        attachments: m.attachments,
        ownerName: m.ownerName,
        lastModifiedBy: m.lastModifiedBy,
        qrToken: m.qrToken,
        departmentConsents: m.departmentConsents,
      })),
      attachments: p.attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileSize: a.fileSize,
        fileType: a.fileType,
        fileData: a.fileData,
        projectId: a.projectId,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  async remove(id: string): Promise<boolean> {
    try {
      await this.prisma.auditProject.delete({
        where: { id },
      });
      return true;
    } catch (e) {
      console.error('Failed to delete project:', e);
      return false;
    }
  }

  async getNextCodePreview(
    prefix: string = 'AP',
    year?: number,
  ): Promise<string> {
    return this.codeGenerator.getNextDocumentCodePreview(prefix, year);
  }
}
