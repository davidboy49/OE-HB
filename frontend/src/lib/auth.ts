import { serverApi, ApiError } from "./apiClient";
import type { User } from "@oeportal/shared";

/** Resolves the current user from the JWT cookie via the backend. Null if not logged in. */
export async function getCurrentUserServer(): Promise<User | null> {
  try {
    return await serverApi<User>("/auth/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

// Permission check (UI-only - the backend's PermissionsGuard is the real enforcement point).
export const RBAC = {
  /**
   * Checks a granular permission key (see backend/src/common/permissions.ts) against
   * the user's effective grants from GET /auth/me. Access is entirely a function of the
   * user's UserGroup - there is no role-based fallback of any kind.
   */
  can(user: User | null, permissionKey: string): boolean {
    return user?.permissions?.includes(permissionKey) ?? false;
  },
};
