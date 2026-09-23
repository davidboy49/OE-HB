import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_AUTHENTICATED_KEY } from '../decorators/authenticated.decorator';
import { DYNAMIC_PERMISSIONS_KEY } from '../decorators/dynamic-permission.decorator';
import { PermissionsResolverService } from '../permissions-resolver.service';
import type { AuthenticatedUser } from '../../auth/auth.types';

/**
 * Enforces access rules on every route, DENYING BY DEFAULT. A route must declare one of:
 *   @Public()                    no login (only login and SSO exchange)
 *   @RequirePermission(key)      the caller must hold this permission (checked here)
 *   @DynamicPermission(...keys)  the handler picks which permission applies and checks it
 *   @Authenticated()             any signed-in user (data the service scopes to the caller)
 * A route with none of them is refused - forgetting a rule can never expose an endpoint.
 * Requires JwtAuthGuard to have already run (reads req.user).
 *
 * Always resolves grants from the DB via PermissionsResolverService rather than trusting
 * anything cached on the caller (e.g. a JWT claim, signed once at login) - there is no
 * special-cased "admin" bypass here, so a group reassignment (including into or out of the
 * full-access "Administrators" group) takes effect on this user's very next request instead
 * of only after they log back in.
 */
@Injectable()
export class PermissionsGuard {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsResolver: PermissionsResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const meta = <T>(key: string) =>
      this.reflector.getAllAndOverride<T | undefined>(key, targets);

    if (meta<boolean>(IS_PUBLIC_KEY)) return true;

    const required = meta<string>(REQUIRE_PERMISSION_KEY);
    if (required) {
      const request = context.switchToHttp().getRequest();
      const user: AuthenticatedUser | undefined = request.user;
      if (!user) throw new ForbiddenException('Access Denied');

      const grantedKeys =
        await this.permissionsResolver.getEffectivePermissions(user.sub);
      if (!grantedKeys.includes(required)) {
        throw new ForbiddenException('Access Denied');
      }
      return true;
    }

    // The handler enforces one of these itself (see DynamicPermission).
    if (meta<string[]>(DYNAMIC_PERMISSIONS_KEY)?.length) return true;
    if (meta<boolean>(IS_AUTHENTICATED_KEY)) return true;

    throw new ForbiddenException('No access rule is defined for this route');
  }
}
