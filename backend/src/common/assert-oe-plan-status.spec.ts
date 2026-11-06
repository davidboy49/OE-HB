/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException } from '@nestjs/common';
import {
  assertOePlanNotClosed,
  assertOePlanReleased,
  assertParentOePlanNotClosed,
} from './assert-oe-plan-status';
import type { PrismaService } from '../prisma/prisma.service';

const prismaWithPlan = (plan: { status: string } | null) =>
  ({
    oePlan: { findUnique: jest.fn().mockResolvedValue(plan) },
  }) as unknown as PrismaService;

describe('assertOePlanReleased (meetings and schedules need a RELEASED OE Plan)', () => {
  it.each(['PLANNING', 'SUBMITTED_FOR_APPROVAL', 'CLOSED'])(
    'refuses a %s plan',
    async (status) => {
      await expect(
        assertOePlanReleased(prismaWithPlan({ status }), 'p1'),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('refuses when the plan does not exist', async () => {
    await expect(
      assertOePlanReleased(prismaWithPlan(null), 'p1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts a RELEASED plan', async () => {
    await expect(
      assertOePlanReleased(prismaWithPlan({ status: 'RELEASED' }), 'p1'),
    ).resolves.toBeUndefined();
  });

  it('does nothing when no OE Plan id is given', async () => {
    const prisma = prismaWithPlan({ status: 'PLANNING' });
    await expect(
      assertOePlanReleased(prisma, undefined),
    ).resolves.toBeUndefined();
    expect(prisma.oePlan.findUnique).not.toHaveBeenCalled();
  });
});

describe('assertOePlanNotClosed (a CLOSED plan blocks new linked records)', () => {
  it('refuses a CLOSED plan with a clear message', async () => {
    await expect(
      assertOePlanNotClosed(prismaWithPlan({ status: 'CLOSED' }), 'p1'),
    ).rejects.toThrow(/CLOSED/);
  });

  it.each(['PLANNING', 'SUBMITTED_FOR_APPROVAL', 'RELEASED'])(
    'allows a %s plan',
    async (status) => {
      await expect(
        assertOePlanNotClosed(prismaWithPlan({ status }), 'p1'),
      ).resolves.toBeUndefined();
    },
  );
});

function prismaWith(plan: { status: string; isDeleted: boolean } | null) {
  const row = plan === null ? null : { oePlan: plan };
  return {
    openMeeting: { findUnique: jest.fn().mockResolvedValue(row) },
    executionSchedule: { findUnique: jest.fn().mockResolvedValue(row) },
  } as any;
}

describe('assertParentOePlanNotClosed', () => {
  it.each(['meeting', 'schedule'] as const)(
    'refuses changes to a %s under a CLOSED plan',
    async (kind) => {
      await expect(
        assertParentOePlanNotClosed(
          prismaWith({ status: 'CLOSED', isDeleted: false }),
          kind,
          'x',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it.each(['PLANNING', 'SUBMITTED_FOR_APPROVAL', 'RELEASED'])(
    'allows changes while the plan is %s',
    async (status) => {
      await expect(
        assertParentOePlanNotClosed(
          prismaWith({ status, isDeleted: false }),
          'schedule',
          'x',
        ),
      ).resolves.toBeUndefined();
    },
  );

  it('leaves a missing record to the caller (its own not-found error)', async () => {
    await expect(
      assertParentOePlanNotClosed(prismaWith(null), 'meeting', 'x'),
    ).resolves.toBeUndefined();
  });
});
