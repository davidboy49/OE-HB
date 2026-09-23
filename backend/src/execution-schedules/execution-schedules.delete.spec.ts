/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { ExecutionSchedulesService } from './execution-schedules.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PlanItemsService } from '../common/plan-items.service';

/**
 * ExecutionSchedule.remove() used to hard-delete, which cascades to delete its Findings (real
 * audit records) with no undo. It now soft-deletes instead - see prisma/schema.prisma's
 * isDeleted comment on this model.
 */
function makeService(
  opts: {
    target?: { isDeleted: boolean } | null;
    updateManyCount?: number;
  } = {},
) {
  const planItems = {
    writeList: jest.fn().mockResolvedValue(undefined),
    readOne: jest.fn().mockResolvedValue('[]'),
    readMany: jest.fn().mockResolvedValue(new Map()),
  } as unknown as PlanItemsService;

  const prisma = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    $queryRaw: jest.fn().mockResolvedValue([]),
    executionSchedule: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          opts.target === undefined ? { isDeleted: false } : opts.target,
        ),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest
        .fn()
        .mockResolvedValue({ count: opts.updateManyCount ?? 1 }),
      update: jest.fn().mockImplementation(({ data }: { data: any }) => ({
        id: 's1',
        oePlan: { name: 'x', code: 'OEP-1' },
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      })),
    },
  } as unknown as PrismaService;

  const service = new ExecutionSchedulesService(prisma, planItems);
  return { service, prisma };
}

describe('ExecutionSchedulesService.remove', () => {
  it('soft-deletes: sets isDeleted, never calls the real delete', async () => {
    const { service, prisma } = makeService();
    await expect(service.remove('s1')).resolves.toBe(true);
    expect(prisma.executionSchedule.updateMany).toHaveBeenCalledWith({
      where: { id: 's1', isDeleted: false },
      data: { isDeleted: true },
    });
    expect((prisma.executionSchedule as any).delete).toBeUndefined();
  });

  it('returns false instead of throwing when already deleted or missing', async () => {
    const { service } = makeService({ updateManyCount: 0 });
    await expect(service.remove('gone')).resolves.toBe(false);
  });
});

describe('ExecutionSchedulesService.findAll', () => {
  it('excludes soft-deleted schedules from the query', async () => {
    const { service, prisma } = makeService();
    await service.findAll();
    expect(prisma.executionSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isDeleted: false }),
      }),
    );
  });
});

describe('ExecutionSchedulesService.findOne', () => {
  it('returns null for a soft-deleted schedule', async () => {
    const { service } = makeService({ target: { isDeleted: true } });
    await expect(service.findOne('s1')).resolves.toBeNull();
  });
});

describe('ExecutionSchedulesService.update', () => {
  it('throws Not Found instead of editing a soft-deleted schedule', async () => {
    const { service } = makeService({ target: { isDeleted: true } });
    await expect(
      service.update('s1', { departments: 'Ops' }, 'Dara'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws Not Found for a schedule that no longer exists', async () => {
    const { service } = makeService({ target: null });
    await expect(
      service.update('gone', { departments: 'Ops' }, 'Dara'),
    ).rejects.toThrow(NotFoundException);
  });
});
