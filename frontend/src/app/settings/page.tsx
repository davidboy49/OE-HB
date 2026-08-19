import { getCurrentUserServer } from "@/lib/auth";
import { apiFetch } from "@/lib/apiClient";
import { redirect } from "next/navigation";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const currentUser = await getCurrentUserServer();
  if (!currentUser) redirect("/login");

  if (currentUser.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const [smtpConfig, templates] = await Promise.all([
    apiFetch<any>("/notifications/smtp-config"),
    apiFetch<any[]>("/notifications/email-templates"),
  ]);

  return (
    <SettingsClient
      currentUser={currentUser}
      initialSmtpConfig={smtpConfig}
      initialTemplates={templates}
    />
  );
}
