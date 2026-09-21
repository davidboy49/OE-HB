/* eslint-disable @typescript-eslint/unbound-method */
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import type { PermissionsResolverService } from '../permissions-resolver.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_AUTHENTICATED_KEY } from '../decorators/authenticated.decorator';
import { DYNAMIC_PERMISSIONS_KEY } from '../decorators/dynamic-permission.decorator';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';

function contextWith(user: unknown): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

/** `metadata` is what the route declares, keyed by decorator metadata key. */
function makeGuard(metadata: Record<string, unknown>, granted: string[]) {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => metadata[key]),
  } as unknown as Reflector;
  const resolver = {
    getEffectivePermissions: jest.fn().mockResolvedValue(granted),
  } as unknown as PermissionsResolverService;
  return { guard: new PermissionsGuard(reflector, resolver), resolver };
}

const requires = (key: string) => ({ [REQUIRE_PERMISSION_KEY]: key });

describe('PermissionsGuard', () => {
  describe('deny by default', () => {
    it('refuses a route that declares no access rule at all', async () => {
      const { guard, resolver } = makeGuard({}, ['oe-plans:view']);
      await expect(
        guard.canActivate(contextWith({ sub: 'u1' })),
      ).rejects.toThrow(ForbiddenException);
      expect(resolver.getEffectivePermissions).not.toHaveBeenCalled();
    });

    it('refuses an undeclared route even for an ADMIN token', async () => {
      const { guard } = makeGuard({}, []);
      await expect(
        guard.canActivate(contextWith({ sub: 'u1', role: 'ADMIN' })),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('explicit declarations', () => {
    it('lets a @Public route through without looking anyone up', async () => {
      const { guard, resolver } = makeGuard({ [IS_PUBLIC_KEY]: true }, []);
      await expect(guard.canActivate(contextWith(undefined))).resolves.toBe(
        true,
      );
      expect(resolver.getEffectivePermissions).not.toHaveBeenCalled();
    });

    it('lets an @Authenticated route through for any signed-in user', async () => {
      const { guard, resolver } = makeGuard(
        { [IS_AUTHENTICATED_KEY]: true },
        [],
      );
      await expect(guard.canActivate(contextWith({ sub: 'u1' }))).resolves.toBe(
        true,
      );
      expect(resolver.getEffectivePermissions).not.toHaveBeenCalled();
    });

    it('lets a @DynamicPermission route through (the handler enforces it)', async () => {
      const { guard } = makeGuard(
        { [DYNAMIC_PERMISSIONS_KEY]: ['oe-plans:submit', 'oe-plans:approve'] },
        [],
      );
      await expect(guard.canActivate(contextWith({ sub: 'u1' }))).resolves.toBe(
        true,
      );
    });
  });

  describe('@RequirePermission', () => {
    it('lets the request through when the user holds the permission', async () => {
      const { guard } = makeGuard(requires('oe-plans:create'), [
        'oe-plans:create',
      ]);
      await expect(guard.canActivate(contextWith({ sub: 'u1' }))).resolves.toBe(
        true,
      );
    });

    it('refuses a user who lacks the permission', async () => {
      const { guard } = makeGuard(requires('oe-plans:approve'), [
        'oe-plans:create',
      ]);
      await expect(
        guard.canActivate(contextWith({ sub: 'u1' })),
      ).rejects.toThrow(ForbiddenException);
    });

    it('holding write access does not imply view access', async () => {
      const { guard } = makeGuard(requires('annual-plans:view'), [
        'annual-plans:create',
        'annual-plans:update',
      ]);
      await expect(
        guard.canActivate(contextWith({ sub: 'u1' })),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuses when there is no signed-in user on the request', async () => {
      const { guard } = makeGuard(requires('oe-plans:create'), [
        'oe-plans:create',
      ]);
      await expect(guard.canActivate(contextWith(undefined))).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('checks the database-fresh grants for the caller, not a role claim', async () => {
      const { guard, resolver } = makeGuard(requires('oe-plans:create'), []);
      await expect(
        guard.canActivate(contextWith({ sub: 'u1', role: 'ADMIN' })),
      ).rejects.toThrow(ForbiddenException);
      expect(resolver.getEffectivePermissions).toHaveBeenCalledWith('u1');
    });
  });
});
