import { apiFetch, fetchOr } from "@/lib/apiClient";
import { guardPage } from "@/lib/page-access";
import type { OePlan, Project, Department, ExecutionSchedule, User } from "@oeportal/shared";
import ScheduleClient from "./schedule-client";

export default async function SchedulePage() {
  const currentUser = await guardPage("/schedule");

  const [projects, schedules, users, departments, plannedEngagements] = await Promise.all([
    fetchOr<OePlan[]>("/oe-plans", []),
    apiFetch<ExecutionSchedule[]>("/execution-schedules"),
    fetchOr<User[]>("/users", []),
    fetchOr<Department[]>("/departments", []),
    fetchOr<Project[]>("/projects", []),
  ]);

  return (
    <ScheduleClient
      initialSchedules={schedules}
      projects={projects}
      users={users}
      departments={departments}
      plannedEngagements={plannedEngagements}
      currentUser={currentUser}
    />
  );
}
