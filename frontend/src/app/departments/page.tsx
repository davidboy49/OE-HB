import { apiFetch, fetchOr } from "@/lib/apiClient";
import { guardPage } from "@/lib/page-access";
import type { User, Department, UserGroup, BusinessUnit } from "@oeportal/shared";
import DepartmentsClient from "./departments-client";

export default async function DepartmentsPage() {
  const currentUser = await guardPage("/departments");

  const [users, departments, userGroups, businessUnits] = await Promise.all([
    fetchOr<User[]>("/users", []),
    apiFetch<Department[]>("/departments"),
    fetchOr<UserGroup[]>("/user-groups", []),
    fetchOr<BusinessUnit[]>("/business-units", []),
  ]);

  return (
    <DepartmentsClient
      initialUsers={users}
      initialDepartments={departments}
      initialUserGroups={userGroups}
      businessUnits={businessUnits}
      currentUser={currentUser}
    />
  );
}
