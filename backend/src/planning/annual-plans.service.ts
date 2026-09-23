import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AnnualPlan } from '@oeportal/shared';
import type { Prisma } from '../generated/prisma/client';

@Injectable()
export class AnnualPlansService {
  constructor(private readonly prisma: PrismaService) {}

  /** `where` is the caller's view scope (see AccessScopeService); omit only for internal use. */
  async findAll(
    where: Prisma.AnnualPlanWhereInput = {},
  ): Promise<AnnualPlan[]> {
    const plans = await this.prisma.annualPlan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return plans.map((p) => ({
      id: p.id,
      planName: p.planName,
      period: p.period,
      comment: p.comment,
      status: p.status,
      createdBy: p.createdBy,
      qrToken: p.qrToken,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  }

  async create(
    planName: string,
    period: string,
    comment: string,
    createdBy: string,
  ): Promise<AnnualPlan> {
    const p = await this.prisma.annualPlan.create({
      data: { planName, period, comment, createdBy },
    });
    return {
      id: p.id,
      planName: p.planName,
      period: p.period,
      comment: p.comment,
      status: p.status,
      createdBy: p.createdBy,
      qrToken: p.qrToken,
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
      createdBy: p.createdBy,
      qrToken: p.qrToken,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  /**
   * Issues a fresh QR token. The old one stops working immediately, so a printed or
   * leaked QR code can be revoked without touching the plan itself.
   */
  async rotateQrToken(id: string): Promise<AnnualPlan> {
    const p = await this.prisma.annualPlan.update({
      where: { id },
      data: { qrToken: randomUUID() },
    });
    return {
      id: p.id,
      planName: p.planName,
      period: p.period,
      comment: p.comment,
      status: p.status,
      createdBy: p.createdBy,
      qrToken: p.qrToken,
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
      createdBy: p.createdBy,
      qrToken: p.qrToken,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  /**
   * Guarded the same way ProjectsService.remove guards a Project: deleting the parent must
   * not be a back door around that check. Without this, Prisma's ON DELETE CASCADE on
   * Project.annualPlanId would silently delete every Project under this plan (and, via each
   * Project's own guard being bypassed, everything reachable from them) the moment someone
   * deleted the Annual Plan instead of a Project directly.
   */
  async remove(id: string): Promise<boolean> {
    const inUse = await this.prisma.project.findFirst({
      where: { annualPlanId: id },
    });
    if (inUse) {
      throw new ConflictException(
        'This Annual Plan already has Projects under it and cannot be deleted.',
      );
    }
    await this.prisma.annualPlan.delete({ where: { id } });
    return true;
  }

  /** Mirrors dbService.getApprovedTopicCounts: occurrence count per topic across APPROVED annual plans. */
  async getApprovedTopicCounts(
    projectScope: Prisma.ProjectWhereInput = {},
  ): Promise<Record<string, number>> {
    const approvedPlans = await this.prisma.project.findMany({
      where: {
        annualPlan: {
          status: 'APPROVED',
        },
        ...projectScope,
      },
      select: {
        topic: true,
        departmentId: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    const counts: Record<string, number> = {};
    for (const p of approvedPlans) {
      // Versions count per department (its id), so two Business Units can both have a
      // "Finance"; older rows without a department fall back to the topic text.
      const key = p.departmentId ?? (p.topic || '').trim().toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }
}
