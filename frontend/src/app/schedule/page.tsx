import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { getCurrentUserServer } from "@/lib/auth";
import type { AuditProject, AuditPlan, Department, ExecutionSchedule, User } from "@auditdesk/shared";
import ScheduleClient from "./schedule-client";

export default async function SchedulePage() {
  const currentUser = await getCurrentUserServer();
  if (!currentUser) redirect("/login");

  const [projects, schedules, users, departments, auditPlans] = await Promise.all([
    apiFetch<AuditProject[]>("/audit-projects"),
    apiFetch<ExecutionSchedule[]>("/execution-schedules"),
    apiFetch<User[]>("/users"),
    apiFetch<Department[]>("/departments"),
    apiFetch<AuditPlan[]>("/audit-plans"),
  ]);

  return (
    <ScheduleClient
      initialSchedules={schedules}
      projects={projects}
      users={users}
      departments={departments}
      auditPlans={auditPlans}
      currentUser={currentUser}
    />
  );
}
