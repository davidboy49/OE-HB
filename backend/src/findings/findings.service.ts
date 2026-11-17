import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertOePlanNotClosed } from '../common/assert-oe-plan-status';
import type { Finding } from '@oeportal/shared';
import type { Prisma } from '../generated/prisma/client';

const findingInclude = {
  executionSchedule: {
    include: {
      oePlan: true,
    },
  },
  member: true,
} as const;

/**
 * `projectId`/`projectName` on the returned Finding are kept as the API's field names for
 * backward compatibility, even though they describe the parent Individual OE Plan
 * (`executionSchedule.oePlanId` in the database), not a Project.
 */
function toFinding(f: {
  id: string;
  title: string;
  description: string;
  status: string;
  severity: string;
  recommendation: string;
  executionScheduleId: string;
  executionSchedule: { oePlanId: string; oePlan: { name: string } };
  memberId: string;
  member: { name: string };
  createdAt: Date;
}): Finding {
  return {
    id: f.id,
    title: f.title,
    description: f.description,
    status: f.status as any,
    severity: f.severity as any,
    recommendation: f.recommendation,
    executionScheduleId: f.executionScheduleId,
    projectId: f.executionSchedule.oePlanId,
    projectName: f.executionSchedule.oePlan.name,
    memberId: f.memberId,
    memberName: f.member.name,
    createdAt: f.createdAt.toISOString(),
  };
}

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
    return findings.map(toFinding);
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
    await assertOePlanNotClosed(this.prisma, sched.oePlanId);
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
    return toFinding(f);
  }

  async updateStatus(id: string, status: any): Promise<Finding | null> {
    const f = await this.prisma.finding.update({
      where: { id },
      data: { status },
      include: findingInclude,
    });
    return toFinding(f);
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
    return toFinding(f);
  }
}
