/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ExecutionSchedulesService } from './execution-schedules.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PlanItemsService } from '../common/plan-items.service';

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

function makePlanItems(): PlanItemsService {
  return {
    writeList: jest.fn().mockResolvedValue(undefined),
    readOne: jest.fn().mockResolvedValue('[]'),
    readMany: jest.fn().mockResolvedValue(new Map()),
  } as unknown as PlanItemsService;
}

const rowsJson = (rows: unknown[]) => JSON.stringify(rows);

describe('ExecutionSchedulesService.resolveFindingRow', () => {
  it('merges only the corrective-action fields of the targeted row, leaving every other field and row untouched', async () => {
    const prisma = makePrisma();
    // Persistent default covers both the initial read and findOne's re-read afterward.
    (prisma.executionSchedule.findUnique as jest.Mock).mockResolvedValue({
      scheduleRows: rowsJson([
        { id: 'r1', activity: 'Other people left this alone', implication: 'Do not touch' },
        { id: 'r2', activity: 'Target row', implication: 'Do not touch either' },
      ]),
      isDeleted: false,
    });
    (prisma.executionSchedule.update as jest.Mock).mockResolvedValue({});
    const service = new ExecutionSchedulesService(prisma, makePlanItems());

    await service.resolveFindingRow(
      's1',
      'r2',
      { correctiveFinalRemarks: 'Fixed it', resolve: true },
      'Dara',
    );

    const written = (prisma.executionSchedule.update as jest.Mock).mock
      .calls[0][0].data.scheduleRows;
    const rows = JSON.parse(written);
    expect(rows[0]).toEqual({
      id: 'r1',
      activity: 'Other people left this alone',
      implication: 'Do not touch',
    });
    expect(rows[1]).toMatchObject({
      id: 'r2',
      activity: 'Target row',
      implication: 'Do not touch either',
      correctiveFinalRemarks: 'Fixed it',
      correctiveFinalUser: 'Dara',
    });
    expect(rows[1].correctiveFinalDatetime).toBeTruthy();
  });

  it('never lets the caller set correctiveFinalUser/correctiveFinalDatetime directly - only resolve:true does, from the authenticated actor', async () => {
    const prisma = makePrisma();
    (prisma.executionSchedule.findUnique as jest.Mock).mockResolvedValue({
      scheduleRows: rowsJson([{ id: 'r1' }]),
      isDeleted: false,
    });
    const service = new ExecutionSchedulesService(prisma, makePlanItems());

    await service.resolveFindingRow(
      's1',
      'r1',
      {
        // @ts-expect-error - deliberately trying to smuggle in fields the DTO doesn't expose
        correctiveFinalUser: 'Someone Else',
        activity: 'Sneaky edit',
        correctiveActionDate: '2026-01-01',
        correctiveActionRemarks: 'Editor-only field',
      },
      'Dara',
    );

    const written = (prisma.executionSchedule.update as jest.Mock).mock
      .calls[0][0].data.scheduleRows;
    const row = JSON.parse(written)[0];
    expect(row.correctiveFinalUser).toBeUndefined();
    expect(row.activity).toBeUndefined();
    expect(row.correctiveActionDate).toBeUndefined();
    expect(row.correctiveActionRemarks).toBeUndefined();
  });

  const resolvedRow = {
    id: 'r1',
    correctiveFinalUser: 'Dara',
    correctiveFinalDatetime: '2026-01-01T00:00:00.000Z',
  };

  it('refuses to undo a resolution (resolve:false) - that is editor-only', async () => {
    const prisma = makePrisma();
    (prisma.executionSchedule.findUnique as jest.Mock).mockResolvedValue({
      scheduleRows: rowsJson([resolvedRow]),
      isDeleted: false,
    });
    const service = new ExecutionSchedulesService(prisma, makePlanItems());

    await expect(
      service.resolveFindingRow('s1', 'r1', { resolve: false }, 'Dara'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.executionSchedule.update).not.toHaveBeenCalled();
  });

  it('refuses to resolve an already-resolved row again, keeping the original resolver and time', async () => {
    const prisma = makePrisma();
    (prisma.executionSchedule.findUnique as jest.Mock).mockResolvedValue({
      scheduleRows: rowsJson([resolvedRow]),
      isDeleted: false,
    });
    const service = new ExecutionSchedulesService(prisma, makePlanItems());

    await expect(
      service.resolveFindingRow('s1', 'r1', { resolve: true }, 'Someone Else'),
    ).rejects.toThrow(ConflictException);
    expect(prisma.executionSchedule.update).not.toHaveBeenCalled();
  });

  it('still lets the resolver update Corrective Action on a resolved row without re-resolving it', async () => {
    const prisma = makePrisma();
    (prisma.executionSchedule.findUnique as jest.Mock).mockResolvedValue({
      scheduleRows: rowsJson([resolvedRow]),
      isDeleted: false,
    });
    const service = new ExecutionSchedulesService(prisma, makePlanItems());

    await service.resolveFindingRow(
      's1',
      'r1',
      { correctiveFinalRemarks: 'Added detail' },
      'Someone Else',
    );

    const written = (prisma.executionSchedule.update as jest.Mock).mock
      .calls[0][0].data.scheduleRows;
    const row = JSON.parse(written)[0];
    expect(row).toMatchObject({ ...resolvedRow, correctiveFinalRemarks: 'Added detail' });
  });

  it("404s with an actionable message when the row id isn't found (e.g. a legacy row saved before ids existed)", async () => {
    const prisma = makePrisma();
    (prisma.executionSchedule.findUnique as jest.Mock).mockResolvedValue({
      scheduleRows: rowsJson([{ activity: 'no id yet' }]),
      isDeleted: false,
    });
    const service = new ExecutionSchedulesService(prisma, makePlanItems());

    await expect(
      service.resolveFindingRow('s1', 'missing-row', { resolve: true }, 'Dara'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.executionSchedule.update).not.toHaveBeenCalled();
  });

  it('404s when the schedule itself does not exist or is soft-deleted', async () => {
    const prisma = makePrisma();
    (prisma.executionSchedule.findUnique as jest.Mock).mockResolvedValue(null);
    const service = new ExecutionSchedulesService(prisma, makePlanItems());

    await expect(
      service.resolveFindingRow('missing', 'r1', { resolve: true }, 'Dara'),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects with a 409 instead of silently overwriting when expectedUpdatedAt no longer matches', async () => {
    const prisma = makePrisma({
      executionSchedule: {
        findUnique: jest.fn().mockResolvedValue({
          scheduleRows: rowsJson([{ id: 'r1' }]),
          isDeleted: false,
        }),
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    });
    const service = new ExecutionSchedulesService(prisma, makePlanItems());

    await expect(
      service.resolveFindingRow(
        's1',
        'r1',
        { resolve: true, expectedUpdatedAt: '2026-01-01T00:00:00.000Z' },
        'Dara',
      ),
    ).rejects.toThrow(ConflictException);
  });
});

describe('ExecutionSchedulesService.update - row id backfill', () => {
  it('gives every row missing an id a stable one when scheduleRows is part of the PATCH body', async () => {
    const prisma = makePrisma();
    (prisma.executionSchedule.update as jest.Mock).mockResolvedValue({
      id: 's1',
      oePlan: { name: 'x', code: 'OEP-1' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = new ExecutionSchedulesService(prisma, makePlanItems());

    await service.update(
      's1',
      { scheduleRows: rowsJson([{ id: 'already-has-one' }, { activity: 'needs one' }]) },
      'Dara',
    );

    const written = (prisma.executionSchedule.update as jest.Mock).mock
      .calls[0][0].data.scheduleRows;
    const rows = JSON.parse(written);
    expect(rows[0].id).toBe('already-has-one');
    expect(rows[1].id).toEqual(expect.any(String));
    expect(rows[1].id.length).toBeGreaterThan(0);
  });

  it('leaves scheduleRows untouched (same string reference-equal content) when every row already has an id', async () => {
    const prisma = makePrisma();
    (prisma.executionSchedule.update as jest.Mock).mockResolvedValue({
      id: 's1',
      oePlan: { name: 'x', code: 'OEP-1' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = new ExecutionSchedulesService(prisma, makePlanItems());
    const original = rowsJson([{ id: 'r1' }, { id: 'r2' }]);

    await service.update('s1', { scheduleRows: original }, 'Dara');

    const written = (prisma.executionSchedule.update as jest.Mock).mock
      .calls[0][0].data.scheduleRows;
    expect(written).toBe(original);
  });
});
