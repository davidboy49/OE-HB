import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { getCurrentUserServer } from "@/lib/auth";
import type { AuditProject, OpenMeeting, User, Department, AuditPlan } from "@auditdesk/shared";
import MeetingsClient from "./meetings-client";

export default async function MeetingsPage() {
  const currentUser = await getCurrentUserServer();
  if (!currentUser) redirect("/login");

  const [projects, schedules, users, departments, auditPlans] = await Promise.all([
    apiFetch<AuditProject[]>("/audit-projects"),
    apiFetch<OpenMeeting[]>("/meetings"),
    apiFetch<User[]>("/users"),
    apiFetch<Department[]>("/departments"),
    apiFetch<AuditPlan[]>("/audit-plans"),
  ]);

  return (
    <MeetingsClient
      initialSchedules={schedules}
      projects={projects}
      users={users}
      departments={departments}
      auditPlans={auditPlans}
      currentUser={currentUser}
    />
  );
}
