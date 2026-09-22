import { apiFetch, fetchOr } from "@/lib/apiClient";
import { guardPage } from "@/lib/page-access";
import type { OePlan, Department, ExecutionSchedule, User } from "@oeportal/shared";
import FindingsAlertsClient from "./findings-alerts-client";

export default async function FindingsAlertsPage() {
  const currentUser = await guardPage("/findings-alerts");

  const [allSchedules, projects, users, departments] = await Promise.all([
    apiFetch<ExecutionSchedule[]>("/execution-schedules"),
    fetchOr<OePlan[]>("/oe-plans", []),
    fetchOr<User[]>("/users", []),
    fetchOr<Department[]>("/departments", []),
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
