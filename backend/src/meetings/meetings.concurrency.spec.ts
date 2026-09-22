/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import type { PrismaService } from '../prisma/prisma.service';

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    $executeRaw: jest.fn().mockResolvedValue(1),
    openMeeting: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'm1',
        isDeleted: false,
        oePlan: { name: 'x', code: 'OEP-1' },
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
    },
    ...overrides,
  } as unknown as PrismaService;
}

describe('MeetingsService.confirmAttendee', () => {
  it('writes a single atomic jsonb_set keyed by the attendee name, not a read/merge/write', async () => {
    const prisma = makePrisma();
    const service = new MeetingsService(prisma);

    await service.confirmAttendee('m1', 'Dara', 'Dara');

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    const args = (prisma.$executeRaw as jest.Mock).mock.calls[0];
    expect(args[1]).toBe('Dara');
    expect(JSON.parse(args[2] as string)).toMatchObject({
      confirmedBy: 'Dara',
    });
    expect(args[3]).toBe('m1');
    expect(prisma.openMeeting.update).not.toHaveBeenCalled();
  });

  it('never sends the meeting back to DRAFT the way the generic update() does', async () => {
    const prisma = makePrisma();
    const service = new MeetingsService(prisma);

    await service.confirmAttendee('m1', 'Dara', 'Dara');

    expect(prisma.openMeeting.updateMany).not.toHaveBeenCalled();
    const sql = (prisma.$executeRaw as jest.Mock).mock.calls[0][0].join('');
    expect(sql).not.toMatch(/status/i);
  });

  it('404s when the meeting does not exist', async () => {
    const prisma = makePrisma({
      openMeeting: {
        findUnique: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
    });
    const service = new MeetingsService(prisma);

    await expect(
      service.confirmAttendee('missing', 'Dara', 'Dara'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});

describe('MeetingsService.update - optimistic concurrency', () => {
  const okData = { address: 'HQ' };

  it('lands the write when nobody else has changed the record since expectedUpdatedAt', async () => {
    const prisma = makePrisma();
    const service = new MeetingsService(prisma);

    await service.update(
      'm1',
      { ...okData, expectedUpdatedAt: '2026-01-01T00:00:00.000Z' },
      'Dara',
    );

    expect(prisma.openMeeting.updateMany).toHaveBeenCalledWith({
      where: { id: 'm1', updatedAt: new Date('2026-01-01T00:00:00.000Z') },
      data: expect.objectContaining({ address: 'HQ', status: 'DRAFT' }),
    });
  });

  it('refuses with a 409 when someone else changed the record first, instead of silently overwriting it', async () => {
    const prisma = makePrisma({
      openMeeting: {
        findUnique: jest.fn().mockResolvedValue({ id: 'm1', isDeleted: false }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn(),
      },
    });
    const service = new MeetingsService(prisma);

    await expect(
      service.update(
        'm1',
        { ...okData, expectedUpdatedAt: '2026-01-01T00:00:00.000Z' },
        'Dara',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('404s instead of a conflict when the meeting was deleted, not just edited', async () => {
    const prisma = makePrisma({
      openMeeting: {
        findUnique: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn(),
      },
    });
    const service = new MeetingsService(prisma);

    await expect(
      service.update(
        'm1',
        { ...okData, expectedUpdatedAt: '2026-01-01T00:00:00.000Z' },
        'Dara',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('skips the concurrency check entirely when expectedUpdatedAt is omitted (unchanged behavior)', async () => {
    const prisma = makePrisma();
    (prisma.openMeeting.update as jest.Mock).mockResolvedValue({
      id: 'm1',
      isDeleted: false,
      oePlan: { name: 'x', code: 'OEP-1' },
    });
    const service = new MeetingsService(prisma);

    await service.update('m1', okData, 'Dara');

    expect(prisma.openMeeting.updateMany).not.toHaveBeenCalled();
    expect(prisma.openMeeting.update).toHaveBeenCalled();
  });
});
