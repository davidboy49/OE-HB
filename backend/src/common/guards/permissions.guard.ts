import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PermissionsResolverService } from '../permissions-resolver.service';
import type { AuthenticatedUser } from '../../auth/auth.types';

/**
 * Enforces @RequirePermission(key) on a route. Requires JwtAuthGuard to have
 * already run (reads req.user). Replaces the old RolesGuard/@Roles() pair -
 * permission grants live on UserGroup now instead of being hardcoded per role.
 *
 * ADMIN always bypasses (there's no lockout scenario - an admin can always
 * fix a misconfigured group's permissions). A user with no group falls back
 * to DEFAULT_PERMISSIONS_BY_ROLE, reproducing pre-permissions-system behavior.
 */
@Injectable()
export class PermissionsGuard {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsResolver: PermissionsResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<
      string | undefined
    >(REQUIRE_PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredPermission) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) {
      throw new ForbiddenException('Access Denied');
    }
    if (user.role === 'ADMIN') return true;

    const grantedKeys = await this.permissionsResolver.getEffectivePermissions(
      user.sub,
      user.role,
    );
    if (!grantedKeys.includes(requiredPermission)) {
      throw new ForbiddenException('Access Denied');
    }
    return true;
  }
}
