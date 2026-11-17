/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PlanItemsService } from '../common/plan-items.service';

/**
 * A Project is the one entity in this rework that keeps hard-delete (nothing of audit value
 * exists on it until an OePlan is created, which the "in use" guard below already rules out).
 * Unlike OePlan/ExecutionSchedule, that means its PlanItem rows need explicit cleanup - there's
 * no DB-level cascade possible on PlanItem's polymorphic ownerId.
 */
function makeService(opts: { oePlanInUse?: object | null } = {}) {
  const prisma = {
    oePlan: {
      findFirst: jest.fn().mockResolvedValue(opts.oePlanInUse ?? null),
    },
    project: {
      delete: jest.fn().mockResolvedValue({ id: 'proj1' }),
    },
  } as unknown as PrismaService;
  const planItems = {
    deleteAllForOwner: jest.fn().mockResolvedValue(undefined),
  } as unknown as PlanItemsService;
  const service = new ProjectsService(prisma, planItems);
  return { service, prisma, planItems };
}

describe('ProjectsService.remove', () => {
  it('refuses to delete while an (active) OePlan uses it', async () => {
    const { service, prisma, planItems } = makeService({
      oePlanInUse: { id: 'oe1' },
    });
    await expect(service.remove('proj1')).rejects.toThrow(ConflictException);
    expect(prisma.project.delete).not.toHaveBeenCalled();
    expect(planItems.deleteAllForOwner).not.toHaveBeenCalled();
  });

  it('only checks against non-deleted OePlans, so a soft-deleted one no longer blocks deletion', async () => {
    const { service, prisma } = makeService({ oePlanInUse: null });
    await service.remove('proj1');
    expect(prisma.oePlan.findFirst).toHaveBeenCalledWith({
      where: { projectId: 'proj1', isDeleted: false },
    });
  });

  it('deletes its own PlanItem rows (objectives and scope) before the hard delete', async () => {
    const { service, prisma, planItems } = makeService({ oePlanInUse: null });
    await service.remove('proj1');
    expect(planItems.deleteAllForOwner).toHaveBeenCalledWith(
      ['PROJECT_OBJECTIVE', 'PROJECT_SCOPE'],
      'proj1',
    );
    expect(prisma.project.delete).toHaveBeenCalledWith({
      where: { id: 'proj1' },
    });
  });
});
