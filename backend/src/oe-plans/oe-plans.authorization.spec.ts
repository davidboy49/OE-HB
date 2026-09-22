import { ForbiddenException } from '@nestjs/common';
import { OePlansService } from './oe-plans.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { CodeGeneratorService } from '../code-generator/code-generator.service';
import type { PermissionsResolverService } from '../common/permissions-resolver.service';
import type { UpdateOePlanDto } from './dto/update-oe-plan.dto';
import type { AuthenticatedUser } from '../auth/auth.types';

const user: AuthenticatedUser = {
  sub: 'u1',
  email: 'a@b.c',
  name: 'A',
  role: 'OE_MEMBER',
  departmentId: null,
};

/** A resolver that behaves like the real one for a fixed set of granted keys. */
function makeService(currentStatus: string | null, granted: string[]) {
  const requirePermission = jest.fn((_u: AuthenticatedUser, key: string) =>
    granted.includes(key)
      ? Promise.resolve()
      : Promise.reject(new ForbiddenException('Access Denied')),
  );
  const prisma = {
    oePlan: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          currentStatus === null ? null : { status: currentStatus },
        ),
    },
  } as unknown as PrismaService;
  const service = new OePlansService(
    prisma,
    {} as CodeGeneratorService,
    { requirePermission } as unknown as PermissionsResolverService,
  );
  return { service, requirePermission };
}

const update = (status?: string) => ({ status }) as unknown as UpdateOePlanDto;

describe('OE Plan status changes need the matching permission', () => {
  it.each([
    ['PLANNING', 'SUBMITTED_FOR_APPROVAL', 'oe-plans:submit'],
    ['SUBMITTED_FOR_APPROVAL', 'RELEASED', 'oe-plans:approve'],
    ['SUBMITTED_FOR_APPROVAL', 'PLANNING', 'oe-plans:approve'],
    ['RELEASED', 'CLOSED', 'oe-plans:close'],
    ['CLOSED', 'RELEASED', 'oe-plans:reopen'],
  ])('%s -> %s requires %s', async (from, to, key) => {
    const { service, requirePermission } = makeService(from, [key]);
    await expect(
      service.assertUpdateAllowed('p1', update(to), user),
    ).resolves.toBeUndefined();
    expect(requirePermission).toHaveBeenCalledWith(user, key);
  });

  it('refuses a submitter who tries to approve (member has submit, not approve)', async () => {
    const { service } = makeService('SUBMITTED_FOR_APPROVAL', [
      'oe-plans:submit',
      'oe-plans:update',
    ]);
    await expect(
      service.assertUpdateAllowed('p1', update('RELEASED'), user),
    ).rejects.toThrow(ForbiddenException);
  });

  it('refuses closing without the close permission even with update rights', async () => {
    const { service } = makeService('RELEASED', ['oe-plans:update']);
    await expect(
      service.assertUpdateAllowed('p1', update('CLOSED'), user),
    ).rejects.toThrow(ForbiddenException);
  });

  it('requires only oe-plans:update for an ordinary edit (no status change)', async () => {
    const { service, requirePermission } = makeService('PLANNING', [
      'oe-plans:update',
    ]);
    await service.assertUpdateAllowed('p1', update(undefined), user);
    await service.assertUpdateAllowed('p1', update('PLANNING'), user);
    expect(requirePermission).toHaveBeenCalledTimes(2);
    expect(requirePermission).toHaveBeenCalledWith(user, 'oe-plans:update');
  });

  it('refuses an ordinary edit without oe-plans:update', async () => {
    const { service } = makeService('PLANNING', ['oe-plans:submit']);
    await expect(
      service.assertUpdateAllowed('p1', update(undefined), user),
    ).rejects.toThrow(ForbiddenException);
  });

  it('falls back to oe-plans:update for an unmapped transition', async () => {
    const { service, requirePermission } = makeService('PLANNING', [
      'oe-plans:update',
    ]);
    await service.assertUpdateAllowed('p1', update('CLOSED'), user);
    expect(requirePermission).toHaveBeenCalledWith(user, 'oe-plans:update');
  });
});
