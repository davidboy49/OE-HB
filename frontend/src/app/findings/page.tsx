import { apiFetch, fetchOr } from "@/lib/apiClient";
import { guardPage } from "@/lib/page-access";
import type { OePlan, Project, ExecutionSchedule, User, Department } from "@oeportal/shared";
import FindingsClient from "./findings-client";

export default async function FindingsPage() {
  const currentUser = await guardPage("/findings");

  const [projects, allSchedules, users, departments, plannedEngagements] = await Promise.all([
    fetchOr<OePlan[]>("/oe-plans", []),
    apiFetch<ExecutionSchedule[]>("/execution-schedules"),
    fetchOr<User[]>("/users", []),
    fetchOr<Department[]>("/departments", []),
    fetchOr<Project[]>("/projects", []),
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
