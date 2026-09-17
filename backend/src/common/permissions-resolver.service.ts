import { ForbiddenException, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_PERMISSIONS_BY_ROLE, PERMISSIONS, PERMISSION_KEYS } from './permissions';
import type { UserRole } from '@auditdesk/shared';
import type { AuthenticatedUser } from '../auth/auth.types';

/**
 * Single place that resolves a user's effective permission-key set. Used by
 * PermissionsGuard (backend enforcement) and AuthService (so the frontend can
 * mirror the same grants when deciding what to show, via GET /auth/me).
 *
 * Deliberately re-reads role + group from the DB on every call instead of
 * trusting the caller's `role` (e.g. from the JWT, which is signed once at
 * login and can go stale for up to the token's lifetime): a role change,
 * an ADMIN promotion/demotion, or a group reassignment must take effect on
 * this user's very next request, not just after they log back in.
 */
@Injectable()
export class PermissionsResolverService implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `Permission` rows are otherwise only populated by the destructive
   * backend/prisma/seed.ts (wipes users/groups - unsafe to rerun against a live
   * DB). Runs on every boot so new keys added to PERMISSIONS in code always have
   * a matching row before a group tries to `connect` to it - createMany with
   * skipDuplicates is a no-op once a key already exists.
   */
  async onApplicationBootstrap() {
    await this.prisma.permission.createMany({
      data: PERMISSIONS,
      skipDuplicates: true,
    });
  }

  async getEffectivePermissions(userId: string): Promise<string[]> {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, groupId: true },
    });
    if (!dbUser) return [];

    const role = dbUser.role as UserRole;
    if (role === 'ADMIN') return PERMISSION_KEYS;

    if (!dbUser.groupId) {
      return DEFAULT_PERMISSIONS_BY_ROLE[role] ?? [];
    }

    const group = await this.prisma.userGroup.findUnique({
      where: { id: dbUser.groupId },
      select: { permissions: { select: { key: true } } },
    });
    return group?.permissions.map((p) => p.key) ?? [];
  }

  /** Throws unless the user's current (DB-fresh) effective grants include `key`. */
  async requirePermission(
    user: AuthenticatedUser,
    key: string,
  ): Promise<void> {
    const granted = await this.getEffectivePermissions(user.sub);
    if (!granted.includes(key)) {
      throw new ForbiddenException('Access Denied');
    }
  }
}
