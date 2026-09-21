import { apiFetch } from "@/lib/apiClient";
import ScanClient from "./scan-client";
import { notFound } from "next/navigation";
import type { OpenMeeting, Department } from "@oeportal/shared";

export const metadata = {
  title: "Open Meeting & Scope Consent | OE Portal",
  description: "Departmental Open Meeting agenda and OE scope confirmation portal."
};

interface PageProps {
  params: Promise<{ qrToken: string }>;
}

// Public route (see middleware.ts PUBLIC_PATHS: "/meetings/scan") - an unauthenticated
// external department PIC scans a physical QR code with no OE Portal account, so this calls the
// backend's @Public() QR endpoint directly. No cookie/token is sent or required.
export default async function ScanPage({ params }: PageProps) {
  const { qrToken } = await params;
  const { schedule, departments, projectMeetings } = await apiFetch<{
    schedule: OpenMeeting | null;
    departments: Department[];
    projectMeetings: OpenMeeting[];
  }>(`/meetings/qr/${qrToken}`);

  if (!schedule) {
    notFound();
  }

  return (
    <ScanClient
      schedule={schedule}
      departmentsList={departments}
      qrToken={qrToken}
      projectMeetingsList={projectMeetings || []}
    />
  );
}
