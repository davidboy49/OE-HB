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
 * Always resolves grants from the DB via PermissionsResolverService rather
 * than trusting req.user.role (the JWT's role claim, signed once at login) -
 * ADMIN is not special-cased here because getEffectivePermissions already
 * returns the full key list for a DB-fresh ADMIN, so a role change, ADMIN
 * promotion/demotion, or group reassignment takes effect on this user's very
 * next request instead of only after they log back in.
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

    const grantedKeys = await this.permissionsResolver.getEffectivePermissions(
      user.sub,
    );
    if (!grantedKeys.includes(requiredPermission)) {
      throw new ForbiddenException('Access Denied');
    }
    return true;
  }
}
