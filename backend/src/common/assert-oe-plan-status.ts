import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Mirrors dbService.assertProjectNotClosed. Blocks writes linked to a CLOSED OE plan. */
export async function assertOePlanNotClosed(
  prisma: PrismaService,
  oePlanId?: string,
): Promise<void> {
  if (!oePlanId) return;
  const plan = await prisma.oePlan.findUnique({
    where: { id: oePlanId },
  });
  if (plan && !plan.isDeleted && plan.status === 'CLOSED') {
    throw new BadRequestException(
      'This OE Plan is CLOSED. No modifications or new records can be linked to a closed OE plan.',
    );
  }
}

/**
 * Blocks creating a child record (Open Meeting, Execution Schedule) until the
 * parent Individual OE Plan has been officially RELEASED. Strictly stronger
 * than assertOePlanNotClosed - a CLOSED OE Plan also fails this check.
 */
export async function assertOePlanReleased(
  prisma: PrismaService,
  oePlanId?: string,
): Promise<void> {
  if (!oePlanId) return;
  const plan = await prisma.oePlan.findUnique({
    where: { id: oePlanId },
  });
  if (!plan || plan.isDeleted || plan.status !== 'RELEASED') {
    throw new BadRequestException(
      'This Individual OE Plan must be RELEASED before Open Meetings or Execution Schedules can be created for it.',
    );
  }
}
