import { SetMetadata } from '@nestjs/common';

export const IS_AUTHENTICATED_KEY = 'isAuthenticatedOnly';

/**
 * Marks a route as intentionally available to ANY signed-in user (no specific permission).
 *
 * Every route must declare how it is protected: @Public() (no login), @RequirePermission(key)
 * or this. A route with none of the three is a mistake, and the route-inventory test fails
 * on it. Use this sparingly - only for things like "who am I" or data the service already
 * scopes to the caller (for example a user's own department's meetings).
 */
export const Authenticated = () => SetMetadata(IS_AUTHENTICATED_KEY, true);
