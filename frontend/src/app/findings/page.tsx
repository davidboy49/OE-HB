import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { getCurrentUserServer } from "@/lib/auth";
import type { AuditProject, ExecutionSchedule, User, Department } from "@auditdesk/shared";
import FindingsClient from "./findings-client";

export default async function FindingsPage() {
  const currentUser = await getCurrentUserServer();
  if (!currentUser) redirect("/login");

  const [projects, allSchedules, users, departments] = await Promise.all([
    apiFetch<AuditProject[]>("/audit-projects"),
    apiFetch<ExecutionSchedule[]>("/execution-schedules"),
    apiFetch<User[]>("/users"),
    apiFetch<Department[]>("/departments"),
  ]);

  // Finding reports are execution schedules with language="finding"
  const findingReports = allSchedules.filter((s) => s.language === "finding");

  // Execution schedules available to link findings to: released, non-finding type
  const releasedExecSchedules = allSchedules.filter(
    (s) => s.language !== "finding" && s.status === "RELEASED"
  );

  return (
    <FindingsClient
      initialSchedules={findingReports}
      releasedExecSchedules={releasedExecSchedules}
      projects={projects}
      users={users}
      departments={departments}
      currentUser={currentUser}
    />
  );
}
