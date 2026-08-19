import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AnnualPlan } from '@auditdesk/shared';

@Injectable()
export class AnnualPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<AnnualPlan[]> {
    const plans = await this.prisma.annualPlan.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return plans.map((p) => ({
      id: p.id,
      planName: p.planName,
      period: p.period,
      comment: p.comment,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  }

  async create(
    planName: string,
    period: string,
    comment: string,
  ): Promise<AnnualPlan> {
    const p = await this.prisma.annualPlan.create({
      data: { planName, period, comment },
    });
    return {
      id: p.id,
      planName: p.planName,
      period: p.period,
      comment: p.comment,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  async update(
    id: string,
    planName: string,
    period: string,
    comment: string,
  ): Promise<AnnualPlan> {
    const p = await this.prisma.annualPlan.update({
      where: { id },
      data: { planName, period, comment },
    });
    return {
      id: p.id,
      planName: p.planName,
      period: p.period,
      comment: p.comment,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  async updateStatus(id: string, status: string): Promise<AnnualPlan> {
    const p = await this.prisma.annualPlan.update({
      where: { id },
      data: { status },
    });
    return {
      id: p.id,
      planName: p.planName,
      period: p.period,
      comment: p.comment,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  async remove(id: string): Promise<boolean> {
    await this.prisma.annualPlan.delete({ where: { id } });
    return true;
  }

  /** Mirrors dbService.getApprovedTopicCounts: occurrence count per topic across APPROVED annual plans. */
  async getApprovedTopicCounts(): Promise<Record<string, number>> {
    const approvedPlans = await this.prisma.auditPlan.findMany({
      where: {
        annualPlan: {
          status: 'APPROVED',
        },
      },
      select: {
        topic: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    const counts: Record<string, number> = {};
    for (const p of approvedPlans) {
      const key = (p.topic || '').trim().toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }
}
