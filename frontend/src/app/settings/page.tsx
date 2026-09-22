import { guardPage } from "@/lib/page-access";
import { apiFetch } from "@/lib/apiClient";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const currentUser = await guardPage("/settings");


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
