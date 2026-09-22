import { apiFetch } from "@/lib/apiClient";
import { guardPage } from "@/lib/page-access";
import LogsClient from "./logs-client";

export default async function LogsPage() {
  const currentUser = await guardPage("/logs");


  const logs = await apiFetch<any[]>("/activity-logs");

  return (
    <LogsClient
      initialLogs={logs}
      currentUser={currentUser}
    />
  );
}
