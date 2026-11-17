"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, MessageSquareWarning, RefreshCw } from "lucide-react";
import type { MeetingResponseDetail } from "@oeportal/shared";
import { clientApi } from "@/lib/apiClient";

const PILL =
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-850";

/**
 * Read-only view of what the meeting's department said. People in the department answer from
 * the page their Annual Plan QR code opens; this is where the meeting's owner reads it.
 */
export default function MeetingResponsesPanel({ meetingId }: { meetingId: string }) {
  const [detail, setDetail] = useState<MeetingResponseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = () => clientApi<MeetingResponseDetail>(`/meeting-responses/meetings/${meetingId}`);

  // First load: state is only set from the promise callbacks (never synchronously in the effect).
  useEffect(() => {
    let cancelled = false;
    fetchDetail()
      .then((d) => !cancelled && setDetail(d))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load the responses."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await fetchDetail());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the responses.");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !detail) return <p className="text-xs text-slate-400">Loading responses...</p>;
  if (error) return <p className="text-xs text-red-600">{error}</p>;
  if (!detail) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          {detail.departmentName}
          {detail.businessUnitName ? ` · ${detail.businessUnitName}` : ""}: {detail.responses.length}
          {detail.memberCount ? ` of ${detail.memberCount}` : ""} responded
          {detail.window.open ? " (still open)" : " (read-only)"}
        </span>
        <button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-1 font-medium hover:text-slate-700">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {detail.responses.length === 0 ? (
        <p className="text-xs italic text-slate-400">Nobody from the department has responded yet.</p>
      ) : (
        <ul className="space-y-2">
          {detail.responses.map((r) => (
            <li key={r.id} className="rounded border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  {r.respondentName} <span className="text-xs font-normal text-slate-400">{r.respondentEmail}</span>
                </span>
                <span className={PILL}>
                  {r.status === "ACCEPTED" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-slate-600" />
                  ) : (
                    <MessageSquareWarning className="h-3.5 w-3.5 text-slate-500" />
                  )}
                  {r.status === "ACCEPTED" ? "Accepted" : "Revision requested"}
                </span>
              </div>
              {r.concern ? (
                <div
                  className="prose prose-sm mt-2 max-w-none dark:prose-invert"
                  // Sanitised on the server before it was stored.
                  dangerouslySetInnerHTML={{ __html: r.concern }}
                />
              ) : (
                <p className="mt-1 text-xs italic text-slate-400">No concern noted.</p>
              )}
              <p className="mt-2 text-[10px] text-slate-400">{new Date(r.updatedAt).toLocaleString("en-GB")}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
