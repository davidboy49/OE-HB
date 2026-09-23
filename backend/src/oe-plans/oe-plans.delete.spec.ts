/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { OePlansService } from './oe-plans.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { CodeGeneratorService } from '../code-generator/code-generator.service';
import type { PermissionsResolverService } from '../common/permissions-resolver.service';
import type { PlanItemsService } from '../common/plan-items.service';

/**
 * OePlan is a real audit record (findings, meeting minutes, schedules, reports all hang off
 * it via cascade) - remove() soft-deletes instead of hard-deleting, so none of that is
 * silently destroyed and there's an undo path. See prisma/schema.prisma's isDeleted comment.
 */
function makeService(
  opts: {
    target?: { isDeleted: boolean } | null;
    updateManyCount?: number;
  } = {},
) {
  const planItems = {
    parseScopeOverrideInput: jest.fn().mockReturnValue({
      inactiveScopeItemIds: undefined,
      extraItemsRaw: undefined,
    }),
    writeList: jest.fn().mockResolvedValue(undefined),
    writeScopeExtraItems: jest.fn().mockResolvedValue(undefined),
    readOne: jest.fn().mockResolvedValue('[]'),
    readScopeOverride: jest
      .fn()
      .mockResolvedValue('{"inactiveIds":[],"extraItems":[]}'),
    readScopeOverrideMany: jest.fn().mockResolvedValue(new Map()),
    readMany: jest.fn().mockResolvedValue(new Map()),
  } as unknown as PlanItemsService;

  const prisma = {
    oePlan: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          opts.target === undefined ? { isDeleted: false } : opts.target,
        ),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest
        .fn()
        .mockResolvedValue({ count: opts.updateManyCount ?? 1 }),
      update: jest.fn().mockImplementation(({ data }: { data: any }) => ({
        id: 'p1',
        code: 'OEP-0001',
        ...data,
        members: [],
        executionSchedules: [],
        openMeetings: [],
        startDate: new Date(),
        endDate: new Date(),
        inactiveScopeItemIds: [],
      })),
    },
  } as unknown as PrismaService;

  const service = new OePlansService(
    prisma,
    {} as CodeGeneratorService,
    {} as PermissionsResolverService,
    planItems,
  );
  return { service, prisma };
}

describe('OePlansService.remove', () => {
  it('soft-deletes: sets isDeleted, never calls the real delete', async () => {
    const { service, prisma } = makeService();
    await expect(service.remove('p1')).resolves.toBe(true);
    expect(prisma.oePlan.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', isDeleted: false },
      data: { isDeleted: true },
    });
    expect((prisma.oePlan as any).delete).toBeUndefined();
  });

  it('returns false instead of throwing when the plan is already deleted or missing', async () => {
    const { service } = makeService({ updateManyCount: 0 });
    await expect(service.remove('gone')).resolves.toBe(false);
  });
});

describe('OePlansService.findAll', () => {
  it('excludes soft-deleted plans from the query', async () => {
    const { service, prisma } = makeService();
    await service.findAll();
    expect(prisma.oePlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isDeleted: false }),
      }),
    );
  });
});

describe('OePlansService.update', () => {
  it('throws Not Found instead of editing a soft-deleted plan', async () => {
    const { service } = makeService({ target: { isDeleted: true } });
    await expect(service.update('p1', { name: 'x' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws Not Found for a plan that no longer exists', async () => {
    const { service } = makeService({ target: null });
    await expect(service.update('gone', { name: 'x' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('proceeds normally for a plan that is not deleted', async () => {
    const { service } = makeService({ target: { isDeleted: false } });
    await expect(service.update('p1', { name: 'x' })).resolves.toBeDefined();
  });
});
