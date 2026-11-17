import { apiFetch, fetchOr } from "@/lib/apiClient";
import { guardPage } from "@/lib/page-access";
import type { OePlan, OpenMeeting, User, Department, Project } from "@oeportal/shared";
import MeetingsClient from "./meetings-client";

export default async function MeetingsPage() {
  const currentUser = await guardPage("/meetings");

  const [projects, schedules, users, departments, plannedEngagements] = await Promise.all([
    fetchOr<OePlan[]>("/oe-plans", []),
    apiFetch<OpenMeeting[]>("/meetings"),
    fetchOr<User[]>("/users", []),
    fetchOr<Department[]>("/departments", []),
    fetchOr<Project[]>("/projects", []),
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
