import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Finding } from '@auditdesk/shared';

const findingInclude = {
  executionSchedule: {
    include: {
      project: true,
    },
  },
  auditor: true,
} as const;

@Injectable()
export class FindingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Mirrors dbService.assertProjectNotClosed: blocks writes linked to a CLOSED audit project. */
  private async assertProjectNotClosed(projectId?: string): Promise<void> {
    if (!projectId) return;
    const proj = await this.prisma.auditProject.findUnique({
      where: { id: projectId },
    });
    if (proj && proj.status === 'CLOSED') {
      throw new BadRequestException(
        'This Audit Plan is CLOSED. No modifications or new records can be linked to a closed audit plan.',
      );
    }
  }

  async findAll(): Promise<Finding[]> {
    const findings = await this.prisma.finding.findMany({
      include: findingInclude,
      orderBy: { createdAt: 'desc' },
    });
    return findings.map((f) => ({
      id: f.id,
      title: f.title,
      description: f.description,
      status: f.status as any,
      severity: f.severity as any,
      recommendation: f.recommendation,
      executionScheduleId: f.executionScheduleId,
      projectId: f.executionSchedule.projectId,
      projectName: f.executionSchedule.project.name,
      auditorId: f.auditorId,
      auditorName: f.auditor.name,
      createdAt: f.createdAt.toISOString(),
    }));
  }

  async create(
    title: string,
    description: string,
    severity: any,
    status: any,
    recommendation: string,
    executionScheduleId: string,
    auditorId: string,
  ): Promise<Finding> {
    const sched = await this.prisma.executionSchedule.findUnique({
      where: { id: executionScheduleId },
    });
    if (!sched) {
      throw new NotFoundException('Execution schedule not found.');
    }
    await this.assertProjectNotClosed(sched.projectId);
    const f = await this.prisma.finding.create({
      data: {
        title,
        description,
        severity,
        status,
        recommendation,
        executionScheduleId,
        auditorId,
      },
      include: findingInclude,
    });
    return {
      id: f.id,
      title: f.title,
      description: f.description,
      status: f.status as any,
      severity: f.severity as any,
      recommendation: f.recommendation,
      executionScheduleId: f.executionScheduleId,
      projectId: f.executionSchedule.projectId,
      projectName: f.executionSchedule.project.name,
      auditorId: f.auditorId,
      auditorName: f.auditor.name,
      createdAt: f.createdAt.toISOString(),
    };
  }

  async updateStatus(id: string, status: any): Promise<Finding | null> {
    const f = await this.prisma.finding.update({
      where: { id },
      data: { status },
      include: findingInclude,
    });
    return {
      id: f.id,
      title: f.title,
      description: f.description,
      status: f.status as any,
      severity: f.severity as any,
      recommendation: f.recommendation,
      executionScheduleId: f.executionScheduleId,
      projectId: f.executionSchedule.projectId,
      projectName: f.executionSchedule.project.name,
      auditorId: f.auditorId,
      auditorName: f.auditor.name,
      createdAt: f.createdAt.toISOString(),
    };
  }

  async update(
    id: string,
    updates: {
      title?: string;
      description?: string;
      severity?: any;
      status?: any;
      recommendation?: string;
    },
  ): Promise<Finding | null> {
    const f = await this.prisma.finding.update({
      where: { id },
      data: updates,
      include: findingInclude,
    });
    return {
      id: f.id,
      title: f.title,
      description: f.description,
      status: f.status as any,
      severity: f.severity as any,
      recommendation: f.recommendation,
      executionScheduleId: f.executionScheduleId,
      projectId: f.executionSchedule.projectId,
      projectName: f.executionSchedule.project.name,
      auditorId: f.auditorId,
      auditorName: f.auditor.name,
      createdAt: f.createdAt.toISOString(),
    };
  }
}
