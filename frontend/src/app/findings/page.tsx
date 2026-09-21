import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { getCurrentUserServer } from "@/lib/auth";
import type { OePlan, PlannedEngagement, ExecutionSchedule, User, Department } from "@oeportal/shared";
import FindingsClient from "./findings-client";

export default async function FindingsPage() {
  const currentUser = await getCurrentUserServer();
  if (!currentUser) redirect("/login");

  const [projects, allSchedules, users, departments, plannedEngagements] = await Promise.all([
    apiFetch<OePlan[]>("/oe-plans"),
    apiFetch<ExecutionSchedule[]>("/execution-schedules"),
    apiFetch<User[]>("/users"),
    apiFetch<Department[]>("/departments"),
    apiFetch<PlannedEngagement[]>("/planned-engagements"),
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
      plannedEngagements={plannedEngagements}
      currentUser={currentUser}
    />
  );
}
