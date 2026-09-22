/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ExecutionSchedulesService } from './execution-schedules.service';
import type { PrismaService } from '../prisma/prisma.service';

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    $executeRaw: jest.fn().mockResolvedValue(1),
    $queryRaw: jest.fn().mockResolvedValue([]),
    executionSchedule: {
      findUnique: jest.fn().mockResolvedValue({ id: 's1', oePlanId: null }),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    ...overrides,
  } as unknown as PrismaService;
}

describe('ExecutionSchedulesService.confirmAttendee', () => {
  it('writes a single atomic jsonb_set keyed by the attendee name, not a read/merge/write', async () => {
    const prisma = makePrisma();
    (prisma.executionSchedule.findUnique as jest.Mock).mockResolvedValue({
      id: 's1',
      oePlan: { name: 'x', code: 'OEP-1' },
    });
    const service = new ExecutionSchedulesService(prisma);

    await service.confirmAttendee('s1', 'Dara', 'Dara');

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    const args = (prisma.$executeRaw as jest.Mock).mock.calls[0];
    // Tagged-template values: [quasis, key, jsonValue, id] in that positional order.
    expect(args[1]).toBe('Dara');
    expect(JSON.parse(args[2] as string)).toMatchObject({
      confirmedBy: 'Dara',
    });
    expect(args[3]).toBe('s1');
    // Never reads-then-writes the whole column - no findMany/JSON.parse round trip needed.
    expect(prisma.executionSchedule.update).not.toHaveBeenCalled();
  });

  it('404s when the schedule does not exist, instead of writing to a nonexistent row', async () => {
    const prisma = makePrisma();
    (prisma.executionSchedule.findUnique as jest.Mock).mockResolvedValue(null);
    const service = new ExecutionSchedulesService(prisma);

    await expect(
      service.confirmAttendee('missing', 'Dara', 'Dara'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});

describe('ExecutionSchedulesService.updateDepartmentConsent', () => {
  it('merges the department key atomically into the target and every sibling schedule', async () => {
    const prisma = makePrisma();
    (prisma.executionSchedule.findUnique as jest.Mock).mockResolvedValue({
      id: 's1',
      oePlanId: 'oe1',
      oePlan: {},
    });
    (prisma.executionSchedule.findMany as jest.Mock).mockResolvedValue([
      { id: 's2' },
      { id: 's3' },
    ]);
    const service = new ExecutionSchedulesService(prisma);

    await service.updateDepartmentConsent('s1', 'dept-1', {
      status: 'ACCEPTED',
      acceptedByUserId: 'u1',
      acceptedByUserName: 'Dara',
      acceptedByUserEmail: 'd@x.com',
      timestamp: '2026-01-01T00:00:00.000Z',
    });

    // One atomic write for s1, one each for the two siblings - never a JSON.parse/mutate/
    // JSON.stringify round trip on the whole column.
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
    const targetIds = (prisma.$executeRaw as jest.Mock).mock.calls.map(
      (c) => c[3],
    );
    expect(targetIds.sort()).toEqual(['s1', 's2', 's3']);
  });
});

describe('ExecutionSchedulesService.update - optimistic concurrency', () => {
  const okData = { departments: 'Ops' };

  it('lands the write when nobody else has changed the record since expectedUpdatedAt', async () => {
    const prisma = makePrisma();
    (prisma.executionSchedule.findUniqueOrThrow as jest.Mock).mockResolvedValue(
      {
        id: 's1',
        oePlan: { name: 'x', code: 'OEP-1' },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );
    const service = new ExecutionSchedulesService(prisma);

    await service.update(
      's1',
      { ...okData, expectedUpdatedAt: '2026-01-01T00:00:00.000Z' },
      'Dara',
    );

    expect(prisma.executionSchedule.updateMany).toHaveBeenCalledWith({
      where: { id: 's1', updatedAt: new Date('2026-01-01T00:00:00.000Z') },
      data: expect.objectContaining({ departments: 'Ops' }),
    });
  });

  it('refuses with a 409 when someone else changed the record first, instead of silently overwriting it', async () => {
    const prisma = makePrisma({
      executionSchedule: {
        findUnique: jest.fn().mockResolvedValue({ id: 's1' }), // still exists
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    });
    const service = new ExecutionSchedulesService(prisma);

    await expect(
      service.update(
        's1',
        { ...okData, expectedUpdatedAt: '2026-01-01T00:00:00.000Z' },
        'Dara',
      ),
    ).rejects.toThrow(ConflictException);
    expect(prisma.executionSchedule.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('404s instead of a conflict when the record was deleted, not just edited', async () => {
    const prisma = makePrisma({
      executionSchedule: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    });
    const service = new ExecutionSchedulesService(prisma);

    await expect(
      service.update(
        's1',
        { ...okData, expectedUpdatedAt: '2026-01-01T00:00:00.000Z' },
        'Dara',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('skips the concurrency check entirely when expectedUpdatedAt is omitted (unchanged behavior)', async () => {
    const prisma = makePrisma();
    (prisma.executionSchedule.update as jest.Mock).mockResolvedValue({
      id: 's1',
      oePlan: { name: 'x', code: 'OEP-1' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = new ExecutionSchedulesService(prisma);

    await service.update('s1', okData, 'Dara');

    expect(prisma.executionSchedule.updateMany).not.toHaveBeenCalled();
    expect(prisma.executionSchedule.update).toHaveBeenCalled();
  });
});
