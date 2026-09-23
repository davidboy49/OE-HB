import {
  ForbiddenException,
  Injectable,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ACCESS_SCOPES, AccessScope, PERMISSIONS, scopesFor } from './permissions';
import type { AuthenticatedUser } from '../auth/auth.types';

/** permission key -> how far that grant reaches. A key that is absent is not granted. */
export type Grants = Record<string, AccessScope>;

/**
 * Resolves what a user may do. Deliberately re-reads group from the DB on every call instead
 * of trusting anything cached on the caller (e.g. a JWT claim, which is signed once at login
 * and can go stale for up to the token's lifetime): a group reassignment must take effect on
 * this user's very next request, not just after they log back in.
 *
 * A user's access comes entirely from their UserGroup's grants - a user with no group has
 * none, full stop. There is no role-based fallback and no special-cased "admin" bypass: full
 * access is just an ordinary group (seeded as "Administrators") that happens to hold every
 * permission key, resolved by the same group lookup as everyone else.
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
      select: { groupId: true },
    });
    if (!dbUser?.groupId) return {};

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

  /**
   * Active users whose group currently grants `key` (any scope - presence only). Used where a
   * safety rule or a routing decision needs "who can do X" rather than a single caller's check,
   * e.g. the last-active-admin lockout guard and the findings-alert email fallback.
   */
  async getActiveUserIdsWithPermission(key: string): Promise<string[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        isActive: true,
        groupId: { not: null },
        group: { grants: { some: { permissionKey: key } } },
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
}
