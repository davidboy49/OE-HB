/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PlanItemsService } from '../common/plan-items.service';

function makeService(status: string) {
  const prisma = {
    openMeeting: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'm1',
        status,
        isDeleted: false,
        oePlan: { name: 'x', code: 'OEP-1' },
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({
        id: 'm1',
        status: 'DRAFT',
        oePlan: { name: 'x', code: 'OEP-1' },
      }),
    },
  } as unknown as PrismaService;
  const planItems = {
    writeList: jest.fn().mockResolvedValue(undefined),
    readOne: jest.fn().mockResolvedValue('[]'),
    readMany: jest.fn().mockResolvedValue(new Map()),
  } as unknown as PlanItemsService;
  return { service: new MeetingsService(prisma, planItems), prisma };
}

describe('MeetingsService.update - locked once submitted', () => {
  it.each(['RELEASED', 'SUBMITTED_FOR_APPROVAL'])(
    'refuses content edits on a %s meeting instead of silently sending it back to DRAFT',
    async (status) => {
      const { service, prisma } = makeService(status);

      await expect(
        service.update('m1', { address: 'Changed' }, 'Dara'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.openMeeting.update).not.toHaveBeenCalled();
      expect(prisma.openMeeting.updateMany).not.toHaveBeenCalled();
    },
  );

  it('still allows edits while DRAFT', async () => {
    const { service, prisma } = makeService('DRAFT');

    await service.update('m1', { address: 'Changed' }, 'Dara');

    expect(prisma.openMeeting.update).toHaveBeenCalled();
  });
});
