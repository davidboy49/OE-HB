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
 * ADMIN gets the full key list here (not a bypass sentinel) so the frontend's
 * membership check (`user.permissions.includes(key)`) works identically for
 * every role - the guard still short-circuits ADMIN separately for the actual
 * enforcement path.
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

  async getEffectivePermissions(
    userId: string,
    role: UserRole,
  ): Promise<string[]> {
    if (role === 'ADMIN') return PERMISSION_KEYS;

    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { groupId: true },
    });

    if (!dbUser?.groupId) {
      return DEFAULT_PERMISSIONS_BY_ROLE[role] ?? [];
    }

    const group = await this.prisma.userGroup.findUnique({
      where: { id: dbUser.groupId },
      select: { permissions: { select: { key: true } } },
    });
    return group?.permissions.map((p) => p.key) ?? [];
  }

  /** Throws unless the user's effective grants include `key`. ADMIN always passes. */
  async requirePermission(
    user: AuthenticatedUser,
    key: string,
  ): Promise<void> {
    if (user.role === 'ADMIN') return;
    const granted = await this.getEffectivePermissions(user.sub, user.role);
    if (!granted.includes(key)) {
      throw new ForbiddenException('Access Denied');
    }
  }
}
