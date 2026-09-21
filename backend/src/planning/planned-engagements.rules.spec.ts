/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException } from '@nestjs/common';
import { PlannedEngagementsService } from './planned-engagements.service';
import type { PrismaService } from '../prisma/prisma.service';

const noDb = {
  department: { findUnique: jest.fn() },
  plannedEngagement: { create: jest.fn(), update: jest.fn() },
} as unknown as PrismaService;

const service = new PlannedEngagementsService(noDb);

const create = (scope: string, departmentId = 'dept-1') =>
  service.create(
    'ap-1',
    'PRJ-001',
    'Warehouse Efficiency',
    departmentId,
    'OE',
    'Related',
    new Date('2026-10-05'),
    new Date('2026-10-09'),
    5,
    'Improve picking',
    '',
    scope,
  );

describe('a Project (Planned Engagement) cannot be saved without scope', () => {
  it.each([
    ['nothing', ''],
    ['an empty item list', '[]'],
    ['a blank default row', JSON.stringify([{ id: 'OE-SCP-01', text: '' }])],
    ['spaces only', JSON.stringify([{ id: 'OE-SCP-01', text: '   ' }])],
  ])('rejects %s on create', async (_label, scope) => {
    await expect(create(scope)).rejects.toThrow(BadRequestException);
    expect(noDb.plannedEngagement.create).not.toHaveBeenCalled();
  });

  it('rejects an empty scope on update too', async () => {
    await expect(
      service.update(
        'pe-1',
        'Warehouse Efficiency',
        'dept-1',
        'OE',
        'Related',
        new Date('2026-10-05'),
        new Date('2026-10-09'),
        5,
        'Improve picking',
        '',
        '',
      ),
    ).rejects.toThrow(/Scope is required/);
  });
});

describe('a Project belongs to exactly one department that has a Business Unit', () => {
  const validScope = JSON.stringify([{ id: 'OE-SCP-01', text: 'Receiving' }]);

  it('rejects an unknown department', async () => {
    (noDb.department.findUnique as jest.Mock).mockResolvedValueOnce(null);
    await expect(create(validScope, 'nope')).rejects.toThrow(
      'Department not found',
    );
  });

  it('rejects a department that has no Business Unit yet', async () => {
    (noDb.department.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'dept-1',
      name: 'Operations',
      businessUnit: null,
    });
    await expect(create(validScope)).rejects.toThrow(/no Business Unit/);
  });
});
