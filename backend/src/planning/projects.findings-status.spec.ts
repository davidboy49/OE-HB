/* eslint-disable @typescript-eslint/unbound-method */
import { ProjectsService } from './projects.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PlanItemsService } from '../common/plan-items.service';

const baseProject = {
  id: 'proj-1',
  annualPlanId: 'ap-1',
  no: 'PRJ-001',
  projectName: 'Warehouse Efficiency',
  departmentId: 'dept-1',
  topic: 'Warehouse',
  bu: 'HB',
  type: 'OE',
  revieweeIds: 'Related',
  conductDate: new Date('2026-10-05'),
  endDate: new Date('2026-10-09'),
  durationDay: 5,
  purpose: 'Improve picking',
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-01'),
  annualPlan: { status: 'APPROVED' },
};

function makeService(oePlans: any[]) {
  const prisma = {
    project: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ ...baseProject, oePlans }]),
    },
  } as unknown as PrismaService;
  const planItems = {
    readMany: jest.fn().mockResolvedValue(new Map()),
  } as unknown as PlanItemsService;
  return { service: new ProjectsService(prisma, planItems) };
}

const findingsSchedule = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'es-1',
  status: 'RELEASED',
  departments: 'Warehouse',
  visitNumber: 'NCN #001/26',
  language: 'finding',
  createdAt: new Date('2026-09-20'),
  scheduleRows: JSON.stringify([
    { id: 'r1', correctiveFinalUser: 'Dara' },
    { id: 'r2', correctiveFinalUser: '' },
  ]),
  ...overrides,
});

const plan = (overrides: Partial<Record<string, unknown>> = {}) => ({
  status: 'RELEASED',
  createdAt: new Date('2026-09-10'),
  closedByName: '',
  closedDate: '',
  executionSchedules: [],
  ...overrides,
});

describe('ProjectsService - findings-derived Pending/Completed status', () => {
  it('reports partial completion when some but not all rows are resolved', async () => {
    const { service } = makeService([
      plan({ executionSchedules: [findingsSchedule()] }),
    ]);
    const [result] = await service.findAll();
    expect(result.findingsReportStatus).toBe('RELEASED');
    expect(result.findingsTotalCount).toBe(2);
    expect(result.findingsCompletedCount).toBe(1);
  });

  it('reports full completion when every row has a correctiveFinalUser', async () => {
    const { service } = makeService([
      plan({
        executionSchedules: [
          findingsSchedule({
            scheduleRows: JSON.stringify([
              { id: 'r1', correctiveFinalUser: 'Dara' },
              { id: 'r2', correctiveFinalUser: 'Sopheak' },
            ]),
          }),
        ],
      }),
    ]);
    const [result] = await service.findAll();
    expect(result.findingsTotalCount).toBe(2);
    expect(result.findingsCompletedCount).toBe(2);
  });

  it('does not populate completion counts while the findings report is still DRAFT', async () => {
    const { service } = makeService([
      plan({
        executionSchedules: [findingsSchedule({ status: 'DRAFT' })],
      }),
    ]);
    const [result] = await service.findAll();
    expect(result.findingsReportStatus).toBe('DRAFT');
    expect(result.findingsCompletedCount).toBeUndefined();
    expect(result.findingsTotalCount).toBeUndefined();
  });

  it('leaves findingsReportStatus undefined when no findings-language schedule exists', async () => {
    const { service } = makeService([
      plan({
        executionSchedules: [
          { ...findingsSchedule(), language: 'schedule' },
        ],
      }),
    ]);
    const [result] = await service.findAll();
    expect(result.findingsReportStatus).toBeUndefined();
  });

  it('picks the most-recently-created findings report when a plan has more than one', async () => {
    const { service } = makeService([
      plan({
        executionSchedules: [
          findingsSchedule({
            id: 'old',
            createdAt: new Date('2026-01-01'),
            scheduleRows: JSON.stringify([{ id: 'r1', correctiveFinalUser: 'Dara' }]),
          }),
          findingsSchedule({
            id: 'new',
            createdAt: new Date('2026-09-25'),
            scheduleRows: JSON.stringify([
              { id: 'r1', correctiveFinalUser: '' },
              { id: 'r2', correctiveFinalUser: '' },
              { id: 'r3', correctiveFinalUser: '' },
            ]),
          }),
        ],
      }),
    ]);
    const [result] = await service.findAll();
    expect(result.findingsTotalCount).toBe(3);
  });

  it('reads closedByName/closedDate off the most-recently-created OE Plan', async () => {
    const { service } = makeService([
      plan({
        status: 'CLOSED',
        closedByName: 'Dara',
        closedDate: '2026-09-30',
      }),
    ]);
    const [result] = await service.findAll();
    expect(result.individualPlanStatus).toBe('CLOSED');
    expect(result.closedByName).toBe('Dara');
    expect(result.closedDate).toBe('2026-09-30');
  });
});
