import { SetMetadata } from '@nestjs/common';

export const DYNAMIC_PERMISSIONS_KEY = 'dynamicPermissions';

/**
 * Declares that the handler itself checks one of these permissions, chosen by what the request
 * does (for example a status change needs "submit" or "approve" depending on the target
 * status). The guard cannot know which, so it lets the request through and the handler MUST
 * call PermissionsResolverService.requirePermission. The keys are listed here so the route
 * inventory, the API Resource Policies page and the route audit test can show them.
 */
export const DynamicPermission = (...permissionKeys: string[]) =>
  SetMetadata(DYNAMIC_PERMISSIONS_KEY, permissionKeys);
