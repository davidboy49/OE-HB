import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'requirePermission';

/** Restricts a route to callers whose group (or role fallback) grants this capability. ADMIN always bypasses. */
export const RequirePermission = (permissionKey: string) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permissionKey);
