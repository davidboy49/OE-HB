/* eslint-disable @typescript-eslint/unbound-method */
import { PermissionsResolverService } from './permissions-resolver.service';
import { PERMISSION_KEYS } from './permissions';
import type { PrismaService } from '../prisma/prisma.service';

function makeResolver(opts: {
  user?: { groupId: string | null } | null;
  grants?: { permissionKey: string; scope: string }[];
  usersWithPermission?: { id: string }[];
  administratorsGroup?: { id: string } | null;
}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(opts.user ?? null),
      findMany: jest.fn().mockResolvedValue(opts.usersWithPermission ?? []),
    },
    userGroup: {
      findUnique: jest.fn().mockResolvedValue(opts.administratorsGroup ?? null),
    },
    groupPermission: {
      findMany: jest.fn().mockResolvedValue(opts.grants ?? []),
      createMany: jest.fn(),
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

  it('gives a user with no group nothing at all - there is no fallback', async () => {
    const { resolver } = makeResolver({ user: { groupId: null } });
    await expect(resolver.getEffectivePermissions('u')).resolves.toEqual([]);
  });

  it("uses the group's grants when the user is in a group", async () => {
    const { resolver } = makeResolver({
      user: { groupId: 'g1' },
      grants: [{ permissionKey: 'meetings:create', scope: 'ALL' }],
    });
    await expect(resolver.getEffectivePermissions('u')).resolves.toEqual([
      'meetings:create',
    ]);
  });

  it('gives a user in an empty group no permissions at all', async () => {
    const { resolver } = makeResolver({ user: { groupId: 'g1' }, grants: [] });
    await expect(resolver.getEffectivePermissions('u')).resolves.toEqual([]);
  });

  it("gives a group holding every key every permission - this is how 'Administrators' works, with no special-casing in code", async () => {
    const { resolver } = makeResolver({
      user: { groupId: 'admin-group' },
      grants: PERMISSION_KEYS.map((permissionKey) => ({
        permissionKey,
        scope: 'ALL',
      })),
    });
    await expect(resolver.getEffectivePermissions('u')).resolves.toEqual(
      PERMISSION_KEYS,
    );
  });

  it('reads group membership from the database on every call', async () => {
    const { resolver, prisma } = makeResolver({ user: { groupId: null } });
    await resolver.getEffectivePermissions('u');
    await resolver.getEffectivePermissions('u');
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
  });
});

describe('PermissionsResolverService.getGrants (scopes)', () => {
  it("returns the scope chosen on the group's grant", async () => {
    const { resolver } = makeResolver({
      user: { groupId: 'g1' },
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
      user: { groupId: 'g1' },
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

  it('gives an ungrouped user no grants at all', async () => {
    const { resolver } = makeResolver({ user: { groupId: null } });
    await expect(resolver.getGrants('u')).resolves.toEqual({});
  });
});

describe('PermissionsResolverService.requirePermission', () => {
  const user = {
    sub: 'u',
    email: 'a@b.c',
    name: 'A',
    departmentId: null,
  };

  it('passes when the permission is granted', async () => {
    const { resolver } = makeResolver({
      user: { groupId: 'g1' },
      grants: [{ permissionKey: 'oe-plans:create', scope: 'ALL' }],
    });
    await expect(
      resolver.requirePermission(user, 'oe-plans:create'),
    ).resolves.toBeUndefined();
  });

  it('throws Access Denied when it is not', async () => {
    const { resolver } = makeResolver({
      user: { groupId: 'g1' },
      grants: [{ permissionKey: 'oe-plans:create', scope: 'ALL' }],
    });
    await expect(
      resolver.requirePermission(user, 'oe-plans:approve'),
    ).rejects.toThrow('Access Denied');
  });

  it('throws Access Denied for a user with no group, for any key', async () => {
    const { resolver } = makeResolver({ user: { groupId: null } });
    await expect(
      resolver.requirePermission(user, 'oe-plans:create'),
    ).rejects.toThrow('Access Denied');
  });
});

describe('PermissionsResolverService.getActiveUserIdsWithPermission', () => {
  it('returns the active users a query for the given key resolves to', async () => {
    const { resolver, prisma } = makeResolver({
      usersWithPermission: [{ id: 'u1' }, { id: 'u2' }],
    });
    await expect(
      resolver.getActiveUserIdsWithPermission('users:update'),
    ).resolves.toEqual(['u1', 'u2']);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          groupId: { not: null },
          group: { grants: { some: { permissionKey: 'users:update' } } },
        }),
      }),
    );
  });

  it('returns an empty array when nobody holds the key', async () => {
    const { resolver } = makeResolver({ usersWithPermission: [] });
    await expect(
      resolver.getActiveUserIdsWithPermission('users:update'),
    ).resolves.toEqual([]);
  });
});

describe('PermissionsResolverService.onApplicationBootstrap', () => {
  it("tops up the Administrators group with every current permission key, so a key added after the group was last edited doesn't end up held by nobody", async () => {
    const { resolver, prisma } = makeResolver({
      administratorsGroup: { id: 'admins-group' },
    });

    await resolver.onApplicationBootstrap();

    expect(prisma.userGroup.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: 'Administrators' } }),
    );
    expect(prisma.groupPermission.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: PERMISSION_KEYS.map((permissionKey) => ({
          groupId: 'admins-group',
          permissionKey,
          scope: 'ALL',
        })),
        skipDuplicates: true,
      }),
    );
  });

  it('does nothing if the Administrators group does not exist yet (e.g. a fresh DB before seeding)', async () => {
    const { resolver, prisma } = makeResolver({ administratorsGroup: null });

    await resolver.onApplicationBootstrap();

    expect(prisma.groupPermission.createMany).not.toHaveBeenCalled();
  });
});
