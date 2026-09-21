/* eslint-disable @typescript-eslint/unbound-method */
import { PermissionsResolverService } from './permissions-resolver.service';
import { DEFAULT_PERMISSIONS_BY_ROLE, PERMISSION_KEYS } from './permissions';
import type { PrismaService } from '../prisma/prisma.service';

function makeResolver(opts: {
  user?: { role: string; groupId: string | null } | null;
  grants?: { permissionKey: string; scope: string }[];
}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(opts.user ?? null),
    },
    groupPermission: {
      findMany: jest.fn().mockResolvedValue(opts.grants ?? []),
    },
    permission: { createMany: jest.fn() },
  } as unknown as PrismaService;
  return { resolver: new PermissionsResolverService(prisma), prisma };
}

describe('PermissionsResolverService.getEffectivePermissions', () => {
  it('returns nothing for a user that no longer exists', async () => {
    const { resolver } = makeResolver({ user: null });
    await expect(resolver.getEffectivePermissions('gone')).resolves.toEqual([]);
  });

  it('gives an ADMIN every permission, regardless of group', async () => {
    const { resolver } = makeResolver({
      user: { role: 'ADMIN', groupId: 'g1' },
      grants: [],
    });
    await expect(resolver.getEffectivePermissions('u')).resolves.toEqual(
      PERMISSION_KEYS,
    );
  });

  it('falls back to the role defaults when the user has no group', async () => {
    const { resolver } = makeResolver({
      user: { role: 'OE_MEMBER', groupId: null },
    });
    await expect(resolver.getEffectivePermissions('u')).resolves.toEqual(
      DEFAULT_PERMISSIONS_BY_ROLE.OE_MEMBER,
    );
  });

  it("uses ONLY the group's grants when the user is in a group (role defaults no longer apply)", async () => {
    const { resolver } = makeResolver({
      user: { role: 'OE_LEADER', groupId: 'g1' },
      grants: [{ permissionKey: 'meetings:create', scope: 'ALL' }],
    });
    await expect(resolver.getEffectivePermissions('u')).resolves.toEqual([
      'meetings:create',
    ]);
  });

  it('gives a user in an empty group no permissions at all', async () => {
    const { resolver } = makeResolver({
      user: { role: 'OE_LEADER', groupId: 'g1' },
      grants: [],
    });
    await expect(resolver.getEffectivePermissions('u')).resolves.toEqual([]);
  });

  it('reads role and group from the database on every call', async () => {
    const { resolver, prisma } = makeResolver({
      user: { role: 'DEPT_PIC', groupId: null },
    });
    await resolver.getEffectivePermissions('u');
    await resolver.getEffectivePermissions('u');
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
  });
});

describe('PermissionsResolverService.getGrants (scopes)', () => {
  it('gives an ADMIN every permission at ALL', async () => {
    const { resolver } = makeResolver({
      user: { role: 'ADMIN', groupId: null },
    });
    const grants = await resolver.getGrants('u');
    expect(Object.keys(grants)).toEqual(PERMISSION_KEYS);
    expect(new Set(Object.values(grants))).toEqual(new Set(['ALL']));
  });

  it("returns the scope chosen on the group's grant", async () => {
    const { resolver } = makeResolver({
      user: { role: 'OE_MEMBER', groupId: 'g1' },
      grants: [
        { permissionKey: 'annual-plans:view', scope: 'DEPARTMENT' },
        { permissionKey: 'oe-plans:view', scope: 'MEMBER' },
        { permissionKey: 'findings:view', scope: 'BU' },
      ],
    });
    await expect(resolver.getGrants('u')).resolves.toEqual({
      'annual-plans:view': 'DEPARTMENT',
      'oe-plans:view': 'MEMBER',
      'findings:view': 'BU',
    });
  });

  it('falls back to ALL only for scopes the permission does not support at all', async () => {
    const { resolver } = makeResolver({
      user: { role: 'OE_MEMBER', groupId: 'g1' },
      grants: [
        // MEMBER makes no sense for Annual Plans, and writes are never scoped
        { permissionKey: 'annual-plans:view', scope: 'MEMBER' },
        { permissionKey: 'oe-plans:create', scope: 'DEPARTMENT' },
        { permissionKey: 'oe-plans:update', scope: 'garbage' },
      ],
    });
    await expect(resolver.getGrants('u')).resolves.toEqual({
      'annual-plans:view': 'ALL',
      'oe-plans:create': 'ALL',
      'oe-plans:update': 'ALL',
    });
  });

  it('gives an ungrouped user the role defaults at ALL', async () => {
    const { resolver } = makeResolver({
      user: { role: 'OE_MEMBER', groupId: null },
    });
    const grants = await resolver.getGrants('u');
    expect(Object.keys(grants)).toEqual(DEFAULT_PERMISSIONS_BY_ROLE.OE_MEMBER);
    expect(new Set(Object.values(grants))).toEqual(new Set(['ALL']));
  });

  it('never grants view access to a department user by default', async () => {
    const { resolver } = makeResolver({
      user: { role: 'DEPT_PIC', groupId: null },
    });
    const keys = Object.keys(await resolver.getGrants('u'));
    expect(keys.filter((k) => k.endsWith(':view'))).toEqual([]);
  });
});

describe('PermissionsResolverService.requirePermission', () => {
  const user = {
    sub: 'u',
    email: 'a@b.c',
    name: 'A',
    role: 'OE_MEMBER' as const,
    departmentId: null,
  };

  it('passes when the permission is granted', async () => {
    const { resolver } = makeResolver({
      user: { role: 'OE_MEMBER', groupId: null },
    });
    await expect(
      resolver.requirePermission(user, 'oe-plans:create'),
    ).resolves.toBeUndefined();
  });

  it('throws Access Denied when it is not', async () => {
    const { resolver } = makeResolver({
      user: { role: 'OE_MEMBER', groupId: null },
    });
    await expect(
      resolver.requirePermission(user, 'oe-plans:approve'),
    ).rejects.toThrow('Access Denied');
  });
});
