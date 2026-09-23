/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException } from '@nestjs/common';
import { OePlansService } from './oe-plans.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { CodeGeneratorService } from '../code-generator/code-generator.service';
import type { PermissionsResolverService } from '../common/permissions-resolver.service';
import type { PlanItemsService } from '../common/plan-items.service';

function makeService(existing?: { startDate: Date; endDate: Date }) {
  // Stubbed to complete without error - these tests are about date-range validation, not
  // about the objectives/scope/dataRequestType content itself.
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
    readMany: jest.fn().mockResolvedValue(new Map()),
  } as unknown as PlanItemsService;

  const prisma = {
    oePlan: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(existing ?? null),
      update: jest.fn().mockImplementation(({ data }: { data: any }) => ({
        id: 'p1',
        code: 'OEP-0001',
        ...data,
        // The service always sends these keys, `undefined` when untouched - fill in
        // Prisma-shaped defaults so the response-mapping code below has something to read.
        members: data.members ?? [],
        executionSchedules: data.executionSchedules ?? [],
        openMeetings: data.openMeetings ?? [],
        startDate: data.startDate ?? existing?.startDate,
        endDate: data.endDate ?? existing?.endDate,
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

describe('OePlansService.create - date range', () => {
  it('rejects an end date before the start date', async () => {
    const { service } = makeService();
    await expect(
      service.create(
        'Warehouse Audit',
        'AUTO',
        'PLANNING',
        '[]',
        'details',
        '2026-10-09',
        '2026-10-05',
        null,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('OePlansService.update - date range on a partial edit', () => {
  const existing = {
    startDate: new Date('2026-10-05'),
    endDate: new Date('2026-10-09'),
  };

  it('rejects moving the start date past the existing end date', async () => {
    const { service } = makeService(existing);
    await expect(
      service.update('p1', { startDate: '2026-10-10' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects moving the end date before the existing start date', async () => {
    const { service } = makeService(existing);
    await expect(
      service.update('p1', { endDate: '2026-10-01' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts a valid change to just one side of the range', async () => {
    const { service } = makeService(existing);
    await expect(
      service.update('p1', { endDate: '2026-10-20' } as any),
    ).resolves.toBeDefined();
  });

  it('does not check dates at all when neither is part of the update', async () => {
    const { service, prisma } = makeService(existing);
    await service.update('p1', { name: 'Renamed' });
    // findUnique is still called once, for the soft-delete existence guard - just never with
    // the date-range-specific select.
    expect(prisma.oePlan.findUnique).not.toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ startDate: true }),
      }),
    );
  });
});
