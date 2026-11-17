import { apiFetch, fetchOr } from "@/lib/apiClient";
import { guardPage } from "@/lib/page-access";
import type { OePlan, User, Department, AnnualPlan, Project, PaginatedResponse } from "@oeportal/shared";
import PlanningClient from "./planning-client";

export default async function PlanningPage() {
  const currentUser = await guardPage("/planning");

  const [projectsPage, users, departments, annualPlans, plannedEngagements] = await Promise.all([
    apiFetch<PaginatedResponse<OePlan>>("/oe-plans/page?page=1&pageSize=10"),
    fetchOr<User[]>("/users", []), // For selecting OE Leader
    fetchOr<Department[]>("/departments", []), // For selecting Departments
    fetchOr<AnnualPlan[]>("/annual-plans", []),
    fetchOr<Project[]>("/projects", []),
  ]);

  return (
    <PlanningClient
      initialProjectsPage={projectsPage}
      users={users}
      departments={departments}
      annualPlans={annualPlans}
      plannedEngagements={plannedEngagements}
      currentUser={currentUser}
    />
  );
}
