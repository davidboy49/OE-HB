import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { getCurrentUserServer } from "@/lib/auth";
import type { OePlan, User, Department, AnnualPlan, PlannedEngagement } from "@oeportal/shared";
import PlanningClient from "./planning-client";

export default async function PlanningPage() {
  const currentUser = await getCurrentUserServer();
  if (!currentUser) redirect("/login");

  const [projects, users, departments, annualPlans, plannedEngagements] = await Promise.all([
    apiFetch<OePlan[]>("/oe-plans"),
    apiFetch<User[]>("/users"), // For selecting OE Leader
    apiFetch<Department[]>("/departments"), // For selecting Departments
    apiFetch<AnnualPlan[]>("/annual-plans"),
    apiFetch<PlannedEngagement[]>("/planned-engagements"),
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
