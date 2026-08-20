import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_PERMISSIONS_BY_ROLE, PERMISSION_KEYS } from './permissions';
import type { UserRole } from '@auditdesk/shared';

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
export class PermissionsResolverService {
  constructor(private readonly prisma: PrismaService) {}

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
}
