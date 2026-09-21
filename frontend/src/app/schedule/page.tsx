import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { getCurrentUserServer } from "@/lib/auth";
import type { OePlan, PlannedEngagement, Department, ExecutionSchedule, User } from "@oeportal/shared";
import ScheduleClient from "./schedule-client";

export default async function SchedulePage() {
  const currentUser = await getCurrentUserServer();
  if (!currentUser) redirect("/login");

  const [projects, schedules, users, departments, plannedEngagements] = await Promise.all([
    apiFetch<OePlan[]>("/oe-plans"),
    apiFetch<ExecutionSchedule[]>("/execution-schedules"),
    apiFetch<User[]>("/users"),
    apiFetch<Department[]>("/departments"),
    apiFetch<PlannedEngagement[]>("/planned-engagements"),
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
