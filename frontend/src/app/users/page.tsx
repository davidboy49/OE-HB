import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { getCurrentUserServer } from "@/lib/auth";
import type { User, Department, UserGroup } from "@auditdesk/shared";
import type { PermissionDef } from "./permission-types";
import UsersClient from "./users-client";

export default async function UsersPage() {
  const currentUser = await getCurrentUserServer();
  if (!currentUser) redirect("/login");

  const [users, departments, userGroups, allPermissions] = await Promise.all([
    apiFetch<User[]>("/users"),
    apiFetch<Department[]>("/departments"),
    apiFetch<UserGroup[]>("/user-groups"),
    apiFetch<PermissionDef[]>("/permissions"),
  ]);

  return (
    <UsersClient
      initialUsers={users}
      initialDepartments={departments}
      initialUserGroups={userGroups}
      allPermissions={allPermissions}
      currentUser={currentUser}
    />
  );
}
