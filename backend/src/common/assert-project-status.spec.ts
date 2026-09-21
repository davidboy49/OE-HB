/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException } from '@nestjs/common';
import {
  assertProjectNotClosed,
  assertProjectReleased,
} from './assert-project-status';
import type { PrismaService } from '../prisma/prisma.service';

const prismaWithPlan = (plan: { status: string } | null) =>
  ({
    oePlan: { findUnique: jest.fn().mockResolvedValue(plan) },
  }) as unknown as PrismaService;

describe('assertProjectReleased (meetings and schedules need a RELEASED OE Plan)', () => {
  it.each(['PLANNING', 'SUBMITTED_FOR_APPROVAL', 'CLOSED'])(
    'refuses a %s plan',
    async (status) => {
      await expect(
        assertProjectReleased(prismaWithPlan({ status }), 'p1'),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('refuses when the plan does not exist', async () => {
    await expect(
      assertProjectReleased(prismaWithPlan(null), 'p1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts a RELEASED plan', async () => {
    await expect(
      assertProjectReleased(prismaWithPlan({ status: 'RELEASED' }), 'p1'),
    ).resolves.toBeUndefined();
  });

  it('does nothing when no project id is given', async () => {
    const prisma = prismaWithPlan({ status: 'PLANNING' });
    await expect(
      assertProjectReleased(prisma, undefined),
    ).resolves.toBeUndefined();
    expect(prisma.oePlan.findUnique).not.toHaveBeenCalled();
  });
});

describe('assertProjectNotClosed (a CLOSED plan blocks new linked records)', () => {
  it('refuses a CLOSED plan with a clear message', async () => {
    await expect(
      assertProjectNotClosed(prismaWithPlan({ status: 'CLOSED' }), 'p1'),
    ).rejects.toThrow(/CLOSED/);
  });

  it.each(['PLANNING', 'SUBMITTED_FOR_APPROVAL', 'RELEASED'])(
    'allows a %s plan',
    async (status) => {
      await expect(
        assertProjectNotClosed(prismaWithPlan({ status }), 'p1'),
      ).resolves.toBeUndefined();
    },
  );
});
