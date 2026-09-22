/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ALLOWED_MEETING_STATUS_TRANSITIONS,
  MeetingsService,
} from './meetings.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PlanItemsService } from '../common/plan-items.service';

function makeService(meeting: { status: string; isDeleted?: boolean } | null) {
  const stored = meeting && {
    id: 'm1',
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...meeting,
  };
  const prisma = {
    openMeeting: {
      findUnique: jest.fn().mockResolvedValue(stored),
      update: jest.fn().mockResolvedValue(stored),
    },
  } as unknown as PrismaService;
  // Not about objectives/scope content - just enough for findOne() to complete.
  const planItems = {
    readOne: jest.fn().mockResolvedValue('[]'),
  } as unknown as PlanItemsService;
  return { service: new MeetingsService(prisma, planItems), prisma };
}

describe('Open Meeting approval order', () => {
  it('follows DRAFT -> SUBMITTED -> RELEASED, with rejection and reopening back to DRAFT', () => {
    expect(ALLOWED_MEETING_STATUS_TRANSITIONS).toEqual({
      DRAFT: ['SUBMITTED_FOR_APPROVAL'],
      SUBMITTED_FOR_APPROVAL: ['RELEASED', 'DRAFT'],
      RELEASED: ['DRAFT'],
    });
  });

  it('allows submitting a draft', async () => {
    const { service, prisma } = makeService({ status: 'DRAFT' });
    await service.updateStatus('m1', 'SUBMITTED_FOR_APPROVAL');
    expect(prisma.openMeeting.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { status: 'SUBMITTED_FOR_APPROVAL' },
    });
  });

  it('allows approving a submitted meeting', async () => {
    const { service, prisma } = makeService({
      status: 'SUBMITTED_FOR_APPROVAL',
    });
    await service.updateStatus('m1', 'RELEASED');
    expect(prisma.openMeeting.update).toHaveBeenCalled();
  });

  it('REFUSES to release a draft that was never submitted', async () => {
    const { service, prisma } = makeService({ status: 'DRAFT' });
    await expect(service.updateStatus('m1', 'RELEASED')).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.openMeeting.update).not.toHaveBeenCalled();
  });

  it('refuses a made-up status and a no-op transition', async () => {
    const { service } = makeService({ status: 'DRAFT' });
    await expect(service.updateStatus('m1', 'BOGUS')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.updateStatus('m1', 'DRAFT')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('cannot skip from released straight to submitted', async () => {
    const { service } = makeService({ status: 'RELEASED' });
    await expect(
      service.updateStatus('m1', 'SUBMITTED_FOR_APPROVAL'),
    ).rejects.toThrow(BadRequestException);
  });

  it('reports a missing or deleted meeting as not found', async () => {
    await expect(
      makeService(null).service.updateStatus('m1', 'RELEASED'),
    ).rejects.toThrow(NotFoundException);
    await expect(
      makeService({ status: 'DRAFT', isDeleted: true }).service.updateStatus(
        'm1',
        'SUBMITTED_FOR_APPROVAL',
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
