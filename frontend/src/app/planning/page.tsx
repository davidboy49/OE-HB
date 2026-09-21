import { apiFetch, fetchOr } from "@/lib/apiClient";
import { guardPage } from "@/lib/page-access";
import type { OePlan, User, Department, AnnualPlan, PlannedEngagement } from "@oeportal/shared";
import PlanningClient from "./planning-client";

export default async function PlanningPage() {
  const currentUser = await guardPage("/planning");

  const [projects, users, departments, annualPlans, plannedEngagements] = await Promise.all([
    apiFetch<OePlan[]>("/oe-plans"),
    fetchOr<User[]>("/users", []), // For selecting OE Leader
    fetchOr<Department[]>("/departments", []), // For selecting Departments
    fetchOr<AnnualPlan[]>("/annual-plans", []),
    fetchOr<PlannedEngagement[]>("/planned-engagements", []),
  ]);

  return (
    <PlanningClient
      initialProjects={projects}
      users={users}
      departments={departments}
      annualPlans={annualPlans}
      plannedEngagements={plannedEngagements}
      currentUser={currentUser}
    />
  );
}
