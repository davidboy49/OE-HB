import { fetchOr } from "@/lib/apiClient";
import { guardPage } from "@/lib/page-access";
import type { User, Department, UserGroup } from "@oeportal/shared";
import UsersClient from "./users-client";

export default async function UsersPage() {
  const currentUser = await guardPage("/users");

  const [users, departments, userGroups] = await Promise.all([
    fetchOr<User[]>("/users", []),
    fetchOr<Department[]>("/departments", []),
    fetchOr<UserGroup[]>("/user-groups", []),
  ]);

  return (
    <UsersClient
      initialUsers={users}
      initialDepartments={departments}
      initialUserGroups={userGroups}
      currentUser={currentUser}
    />
  );
}
