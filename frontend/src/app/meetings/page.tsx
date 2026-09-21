import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { getCurrentUserServer } from "@/lib/auth";
import type { OePlan, OpenMeeting, User, Department, PlannedEngagement } from "@oeportal/shared";
import MeetingsClient from "./meetings-client";

export default async function MeetingsPage() {
  const currentUser = await getCurrentUserServer();
  if (!currentUser) redirect("/login");

  const [projects, schedules, users, departments, plannedEngagements] = await Promise.all([
    apiFetch<OePlan[]>("/oe-plans"),
    apiFetch<OpenMeeting[]>("/meetings"),
    apiFetch<User[]>("/users"),
    apiFetch<Department[]>("/departments"),
    apiFetch<PlannedEngagement[]>("/planned-engagements"),
  ]);

  return (
    <MeetingsClient
      initialSchedules={schedules}
      projects={projects}
      users={users}
      departments={departments}
      plannedEngagements={plannedEngagements}
      currentUser={currentUser}
    />
  );
}
