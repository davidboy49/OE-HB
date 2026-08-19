import { apiFetch } from "@/lib/apiClient";
import { getCurrentUserServer } from "@/lib/auth";
import { redirect } from "next/navigation";
import LogsClient from "./logs-client";

export default async function LogsPage() {
  const currentUser = await getCurrentUserServer();
  if (!currentUser) redirect("/login");

  // Restrict page access to ADMIN only
  if (currentUser.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const logs = await apiFetch<any[]>("/activity-logs");

  return (
    <LogsClient
      initialLogs={logs}
      currentUser={currentUser}
    />
  );
}
