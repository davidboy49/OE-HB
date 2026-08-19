import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { getCurrentUserServer } from "@/lib/auth";
import type { AuditProject, User, Department, AnnualPlan, AuditPlan } from "@auditdesk/shared";
import PlanningClient from "./planning-client";

export default async function PlanningPage() {
  const currentUser = await getCurrentUserServer();
  if (!currentUser) redirect("/login");

  const [projects, users, departments, annualPlans, auditPlans] = await Promise.all([
    apiFetch<AuditProject[]>("/audit-projects"),
    apiFetch<User[]>("/users"), // For selecting Lead Auditor
    apiFetch<Department[]>("/departments"), // For selecting Departments
    apiFetch<AnnualPlan[]>("/annual-plans"),
    apiFetch<AuditPlan[]>("/audit-plans"),
  ]);

  return (
    <PlanningClient
      initialProjects={projects}
      users={users}
      departments={departments}
      annualPlans={annualPlans}
      auditPlans={auditPlans}
      currentUser={currentUser}
    />
  );
}
