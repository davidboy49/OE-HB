import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { getCurrentUserServer } from "@/lib/auth";
import type { OePlan, Department, ExecutionSchedule, User } from "@oeportal/shared";
import FindingsAlertsClient from "./findings-alerts-client";

export default async function FindingsAlertsPage() {
  const currentUser = await getCurrentUserServer();
  if (!currentUser) redirect("/login");

  const [allSchedules, projects, users, departments] = await Promise.all([
    apiFetch<ExecutionSchedule[]>("/execution-schedules"),
    apiFetch<OePlan[]>("/oe-plans"),
    apiFetch<User[]>("/users"),
    apiFetch<Department[]>("/departments"),
  ]);

  // Finding reports are execution schedules with language="finding"
  const findingReports = allSchedules.filter((s) => s.language === "finding");

  return (
    <FindingsAlertsClient
      initialSchedules={findingReports}
      projects={projects}
      users={users}
      departments={departments}
      currentUser={currentUser}
    />
  );
}
