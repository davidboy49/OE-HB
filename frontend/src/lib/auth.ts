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

// Role authorization rules (UI-only - the backend's PermissionsGuard is the real enforcement point).
export const RBAC = {
  /**
   * Checks a granular permission key (see backend/src/common/permissions.ts) against
   * the user's effective grants from GET /auth/me. Prefer this over the named
   * role-based helpers below for anything gating a specific create/update/delete action.
   */
  can(user: User | null, permissionKey: string): boolean {
    return user?.permissions?.includes(permissionKey) ?? false;
  },
  isAdmin(user: User): boolean {
    return user.role === "ADMIN";
  },
  canManageUsers(user: User): boolean {
    return user.role === "ADMIN" || user.role === "OE_LEADER";
  },
  canCreateProject(user: User): boolean {
    return user.role === "ADMIN" || user.role === "OE_LEADER";
  },
  canEditScope(user: User): boolean {
    return user.role === "ADMIN" || user.role === "OE_LEADER";
  },
  canWriteFinding(user: User): boolean {
    return user.role === "ADMIN" || user.role === "OE_LEADER" || user.role === "OE_MEMBER";
  },
  canUploadDocuments(_user: User): boolean {
    return true;
  },
  canApproveReport(user: User): boolean {
    return user.role === "ADMIN" || user.role === "OE_LEADER";
  },
  canApproveAnnualPlan(user: User): boolean {
    return user.role === "ADMIN" || user.role === "OE_LEADER";
  },
};
