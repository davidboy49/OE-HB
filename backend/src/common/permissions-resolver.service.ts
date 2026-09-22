import {
  ForbiddenException,
  Injectable,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACCESS_SCOPES,
  AccessScope,
  PERMISSIONS,
  PERMISSION_KEYS,
  scopesFor,
} from './permissions';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { UserRole } from '@oeportal/shared';

/** permission key -> how far that grant reaches. A key that is absent is not granted. */
export type Grants = Record<string, AccessScope>;

/**
 * Resolves what a user may do. Deliberately re-reads role + group from the DB on every call
 * instead of trusting the caller's `role` (e.g. from the JWT, which is signed once at login
 * and can go stale for up to the token's lifetime): a role change, an ADMIN promotion or
 * demotion, or a group reassignment must take effect on this user's very next request, not
 * just after they log back in.
 *
 * `role` only ever does one thing here: ADMIN gets every permission. Everyone else's access
 * comes entirely from their UserGroup's grants - a user with no group has none, full stop.
 * There is deliberately no role-based fallback: an ungrouped non-admin is locked out rather
 * than silently getting some default set of access an admin never actually chose for them.
 *
 * This is the single place that answers "what is this user allowed to do?", so it is also
 * the one seam to change if grants ever come from somewhere else (an external IAM, Keycloak
 * roles, ...). Everything else - the guard, the scope filters, the menu - asks this service.
 */
@Injectable()
export class PermissionsResolverService implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `Permission` rows are otherwise only populated by the destructive
   * backend/prisma/seed.ts (wipes users/groups - unsafe to rerun against a live
   * DB). Runs on every boot so new keys added to PERMISSIONS in code always have
   * a matching row before a group tries to be granted them - createMany with
   * skipDuplicates is a no-op once a key already exists.
   */
  async onApplicationBootstrap() {
    await this.prisma.permission.createMany({
      data: PERMISSIONS,
      skipDuplicates: true,
    });
  }

  async getGrants(userId: string): Promise<Grants> {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, groupId: true },
    });
    if (!dbUser) return {};

    const role = dbUser.role as UserRole;
    const all = (keys: string[]): Grants =>
      Object.fromEntries(keys.map((k) => [k, 'ALL']));

    if (role === 'ADMIN') return all(PERMISSION_KEYS);
    // No group = no grants. `role` otherwise plays no part in what a user may do -
    // access is entirely a function of the group an admin has assigned them to.
    if (!dbUser.groupId) return {};

    const rows = await this.prisma.groupPermission.findMany({
      where: { groupId: dbUser.groupId },
      select: { permissionKey: true, scope: true },
    });
    const grants: Grants = {};
    for (const r of rows) {
      // A scope the permission does not support (or a corrupt value) is treated as the
      // narrowest sensible reading: unscoped keys are always ALL.
      const scope = ACCESS_SCOPES.find((s) => s === r.scope) ?? 'ALL';
      grants[r.permissionKey] = scopesFor(r.permissionKey).includes(scope)
        ? scope
        : 'ALL';
    }
    return grants;
  }

  async getEffectivePermissions(userId: string): Promise<string[]> {
    return Object.keys(await this.getGrants(userId));
  }

  /** Throws unless the user's current (DB-fresh) effective grants include `key`. */
  async requirePermission(user: AuthenticatedUser, key: string): Promise<void> {
    const granted = await this.getEffectivePermissions(user.sub);
    if (!granted.includes(key)) {
      throw new ForbiddenException('Access Denied');
    }
  }
}
