import { redirect } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/apiClient";
import { getCurrentUserServer } from "@/lib/auth";
import type { ScanPayload } from "@oeportal/shared";
import ScanClient from "./scan-client";

export const metadata = {
  title: "My Department's Open Meetings | OE Portal",
  description: "Open Meetings for your department, from a scanned Annual Plan QR code.",
};

interface PageProps {
  params: Promise<{ token: string }>;
}

/**
 * Target of an Annual Plan QR code. Signing in is required (the middleware sends visitors to
 * /login?from=/scan/<token> and back). The department comes from the signed-in user's
 * registered department, never from the URL.
 */
export default async function ScanPage({ params }: PageProps) {
  const currentUser = await getCurrentUserServer();
  const { token } = await params;
  if (!currentUser) redirect(`/login?from=${encodeURIComponent(`/scan/${token}`)}`);

  let payload: ScanPayload | null = null;
  let error: string | null = null;
  try {
    payload = await apiFetch<ScanPayload>(`/meeting-responses/scan/${encodeURIComponent(token)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect(`/login?from=${encodeURIComponent(`/scan/${token}`)}`);
    }
    error = err instanceof ApiError ? err.message : "Could not load your meetings. Please try again.";
  }

  return <ScanClient payload={payload} error={error} />;
}
