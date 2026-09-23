/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException } from '@nestjs/common';
import { AnnualPlansService } from './annual-plans.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Deleting an Annual Plan cascades (ON DELETE CASCADE) to delete every Project under it -
 * bypassing ProjectsService.remove's own "in use by an OePlan" guard entirely, since the
 * cascade happens at the database level, not through that service. This guard closes that
 * back door the same way Project's own guard works.
 */
function makeService(opts: { projectInUse?: object | null } = {}) {
  const prisma = {
    project: {
      findFirst: jest.fn().mockResolvedValue(opts.projectInUse ?? null),
    },
    annualPlan: {
      delete: jest.fn().mockResolvedValue({ id: 'ap1' }),
    },
  } as unknown as PrismaService;
  const service = new AnnualPlansService(prisma);
  return { service, prisma };
}

describe('AnnualPlansService.remove', () => {
  it('refuses to delete while it still has Projects under it', async () => {
    const { service, prisma } = makeService({ projectInUse: { id: 'proj1' } });
    await expect(service.remove('ap1')).rejects.toThrow(ConflictException);
    expect(prisma.annualPlan.delete).not.toHaveBeenCalled();
  });

  it('deletes when it has no Projects', async () => {
    const { service, prisma } = makeService({ projectInUse: null });
    await expect(service.remove('ap1')).resolves.toBe(true);
    expect(prisma.annualPlan.delete).toHaveBeenCalledWith({
      where: { id: 'ap1' },
    });
  });
});
