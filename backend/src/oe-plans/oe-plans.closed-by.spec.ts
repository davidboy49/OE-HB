/* eslint-disable @typescript-eslint/unbound-method */
import { OePlansService } from './oe-plans.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { CodeGeneratorService } from '../code-generator/code-generator.service';
import type { PermissionsResolverService } from '../common/permissions-resolver.service';
import type { PlanItemsService } from '../common/plan-items.service';

function makeService(currentStatus: string) {
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
      findUnique: jest
        .fn()
        .mockResolvedValue({ isDeleted: false, status: currentStatus }),
      update: jest.fn().mockImplementation(({ data }: { data: any }) => ({
        id: 'p1',
        code: 'OEP-0001',
        ...data,
        members: data.members ?? [],
        executionSchedules: data.executionSchedules ?? [],
        openMeetings: data.openMeetings ?? [],
        startDate: data.startDate ?? new Date('2026-01-01'),
        endDate: data.endDate ?? new Date('2026-01-31'),
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

describe('OePlansService.update - closed-by tracking', () => {
  it('stamps closedByName/closedDate with the caller on RELEASED->CLOSED', async () => {
    const { service, prisma } = makeService('RELEASED');

    const result = await service.update(
      'p1',
      { status: 'CLOSED' } as any,
      'Dara',
    );

    expect(prisma.oePlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ closedByName: 'Dara' }),
      }),
    );
    expect(result?.closedByName).toBe('Dara');
    expect(result?.closedDate).toBeTruthy();
  });

  it('clears closedByName/closedDate on CLOSED->RELEASED (reopen)', async () => {
    const { service, prisma } = makeService('CLOSED');

    const result = await service.update(
      'p1',
      { status: 'RELEASED' } as any,
      'Dara',
    );

    expect(prisma.oePlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ closedByName: '', closedDate: '' }),
      }),
    );
    expect(result?.closedByName).toBe('');
    expect(result?.closedDate).toBe('');
  });

  it('never touches closedByName/closedDate on a plain field edit (status unchanged)', async () => {
    const { service, prisma } = makeService('RELEASED');

    await service.update('p1', { name: 'Renamed' }, 'Dara');

    const call = (prisma.oePlan.update as jest.Mock).mock.calls[0][0];
    expect(call.data).not.toHaveProperty('closedByName');
    expect(call.data).not.toHaveProperty('closedDate');
  });

  it('never touches closedByName/closedDate for a status change that is not into or out of CLOSED', async () => {
    const { service, prisma } = makeService('PLANNING');

    await service.update(
      'p1',
      { status: 'SUBMITTED_FOR_APPROVAL' } as any,
      'Dara',
    );

    const call = (prisma.oePlan.update as jest.Mock).mock.calls[0][0];
    expect(call.data).not.toHaveProperty('closedByName');
    expect(call.data).not.toHaveProperty('closedDate');
  });

  it('ignores any closedByName the caller tries to smuggle in - only the transition rule sets it', async () => {
    const { service, prisma } = makeService('RELEASED');

    await service.update(
      'p1',
      { status: 'CLOSED', closedByName: 'Someone Else' } as any,
      'Dara',
    );

    const call = (prisma.oePlan.update as jest.Mock).mock.calls[0][0];
    expect(call.data.closedByName).toBe('Dara');
  });
});
