import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { getCurrentUserServer } from "@/lib/auth";
import type { User, Department, UserGroup } from "@auditdesk/shared";
import DepartmentsClient from "./departments-client";

export default async function DepartmentsPage() {
  const currentUser = await getCurrentUserServer();
  if (!currentUser) redirect("/login");

  const [users, departments, userGroups] = await Promise.all([
    apiFetch<User[]>("/users"),
    apiFetch<Department[]>("/departments"),
    apiFetch<UserGroup[]>("/user-groups"),
  ]);

  return (
    <DepartmentsClient
      initialUsers={users}
      initialDepartments={departments}
      initialUserGroups={userGroups}
      currentUser={currentUser}
    />
  );
}
