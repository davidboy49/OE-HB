import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertProjectNotClosed } from '../common/assert-project-status';
import type { Finding } from '@oeportal/shared';
import type { Prisma } from '../generated/prisma/client';

const findingInclude = {
  executionSchedule: {
    include: {
      project: true,
    },
  },
  member: true,
} as const;

@Injectable()
export class FindingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** `where` is the caller's view scope (see AccessScopeService). */
  async findAll(where: Prisma.FindingWhereInput = {}): Promise<Finding[]> {
    const findings = await this.prisma.finding.findMany({
      where,
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
      memberId: f.memberId,
      memberName: f.member.name,
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
    memberId: string,
  ): Promise<Finding> {
    const sched = await this.prisma.executionSchedule.findUnique({
      where: { id: executionScheduleId },
    });
    if (!sched) {
      throw new NotFoundException('Execution schedule not found.');
    }
    if (sched.status !== 'RELEASED') {
      throw new BadRequestException(
        'This Execution Schedule must be RELEASED before findings can be logged against it.',
      );
    }
    await assertProjectNotClosed(this.prisma, sched.projectId);
    const f = await this.prisma.finding.create({
      data: {
        title,
        description,
        severity,
        status,
        recommendation,
        executionScheduleId,
        memberId,
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
      memberId: f.memberId,
      memberName: f.member.name,
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
      memberId: f.memberId,
      memberName: f.member.name,
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
      memberId: f.memberId,
      memberName: f.member.name,
      createdAt: f.createdAt.toISOString(),
    };
  }
}
