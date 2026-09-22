"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Building2,
  MapPin,
  MinusCircle,
  MessageSquareWarning,
  Users,
} from "lucide-react";
import { formatPlanItemsAsText } from "@oeportal/shared";
import type {
  DepartmentProgress,
  MeetingResponseCard,
  MeetingResponseDetail,
  MeetingResponseItem,
  MeetingResponseStatus,
  ScanPayload,
} from "@oeportal/shared";
import { clientApi } from "@/lib/apiClient";
import RichEditor from "@/components/ui/rich-editor";

interface ScanClientProps {
  payload: ScanPayload | null;
  error: string | null;
}

const PILL =
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-850";

const PROGRESS: Record<DepartmentProgress, { label: string; icon: React.ReactNode }> = {
  AWAITING: { label: "Awaiting response", icon: <Clock className="w-3.5 h-3.5 text-slate-400" /> },
  RESPONDED: { label: "Responded", icon: <CheckCircle2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" /> },
  DONE: { label: "Done", icon: <CheckCircle2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" /> },
  MISSED: { label: "No response", icon: <MinusCircle className="w-3.5 h-3.5 text-slate-400" /> },
};

const STATUS_LABEL: Record<MeetingResponseStatus, string> = {
  ACCEPTED: "Accepted",
  REVISION_REQUESTED: "Revision requested",
};

function formatDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso || "No date"
    : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function ResponseStatusPill({ status }: { status: MeetingResponseStatus }) {
  return (
    <span className={PILL}>
      {status === "ACCEPTED" ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
      ) : (
        <MessageSquareWarning className="w-3.5 h-3.5 text-slate-500" />
      )}
      {STATUS_LABEL[status]}
    </span>
  );
}

export default function ScanClient({ payload, error }: ScanClientProps) {
  const [meetings, setMeetings] = useState<MeetingResponseCard[]>(payload?.meetings ?? []);

  const open = meetings.filter((m) => m.window.open);
  const closed = meetings.filter((m) => !m.window.open);

  const updateCard = (id: string, patch: Partial<MeetingResponseCard>) =>
    setMeetings((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">OE Portal</p>
            <h1 className="truncate text-base font-semibold">
              {payload ? payload.annualPlan.planName : "Open Meetings"}
            </h1>
          </div>
          <Link href="/dashboard" className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline">
            Portal
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        {error && (
          <div className="rounded-lg border border-border bg-card p-5 text-sm">
            <div className="mb-1 flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> This QR code can&apos;t be used
            </div>
            <p className="text-muted-foreground">{error}</p>
          </div>
        )}

        {payload && (
          <>
            <section className="rounded-lg border border-border bg-card p-4 text-sm">
              <p className="font-semibold">{payload.viewer.name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                {payload.viewer.departmentName
                  ? `${payload.viewer.departmentName}${payload.viewer.businessUnitName ? ` · ${payload.viewer.businessUnitName}` : ""}`
                  : "No department"}
              </p>
              {payload.viewer.canViewAll && (
                <p className="mt-2 text-xs text-muted-foreground">
                  You can see every Open Meeting for this plan.{" "}
                  <Link href="/meeting-responses" className="font-medium text-primary hover:underline">
                    Open the responses overview
                  </Link>
                </p>
              )}
            </section>

            {payload.noDepartment && (
              <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  <strong>You are not registered in a department.</strong> Please contact an admin so they can assign
                  you to one. Your department&apos;s Open Meetings will then appear here.
                </p>
              </div>
            )}

            {!payload.noDepartment && meetings.length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No Open Meetings have been released for {payload.viewer.canViewAll ? "this plan" : "your department"} yet.
              </div>
            )}

            {open.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Open for response ({open.length})
                </h2>
                {open.map((m) => (
                  <MeetingPanel key={m.id} card={m} showDepartment={payload.viewer.canViewAll} onChange={updateCard} />
                ))}
              </section>
            )}

            {closed.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Closed, read-only ({closed.length})
                </h2>
                {closed.map((m) => (
                  <MeetingPanel key={m.id} card={m} showDepartment={payload.viewer.canViewAll} onChange={updateCard} />
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function MeetingPanel({
  card,
  showDepartment,
  onChange,
}: {
  card: MeetingResponseCard;
  showDepartment: boolean;
  onChange: (id: string, patch: Partial<MeetingResponseCard>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<MeetingResponseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setDetail(await clientApi<MeetingResponseDetail>(`/meeting-responses/meetings/${card.id}`));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load this meeting.");
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !detail && !loading) void load();
  };

  const progress = PROGRESS[card.progress];

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card">
      <button type="button" onClick={toggle} className="flex w-full items-start gap-3 p-4 text-left" aria-expanded={expanded}>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-muted-foreground">{card.projectCode}</span>
            <span className={PILL}>
              {progress.icon}
              {card.myResponse && card.window.open ? "You responded" : progress.label}
            </span>
          </div>
          <h3 className="text-sm font-semibold leading-snug">{card.projectName}</h3>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> {formatDate(card.meetingDate)}
            </span>
            {showDepartment && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" /> {card.departmentName}
                {card.businessUnitName ? ` · ${card.businessUnitName}` : ""}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {card.responseCount} response{card.responseCount === 1 ? "" : "s"}
            </span>
          </p>
        </div>
        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="space-y-5 border-t border-border p-4">
          {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {loadError && <p className="text-sm text-red-600">{loadError}</p>}
          {detail && (
            <MeetingDetail
              detail={detail}
              onSaved={(fresh) => {
                setDetail(fresh);
                onChange(card.id, {
                  myResponse: fresh.myResponse,
                  responseCount: fresh.responseCount,
                  revisionCount: fresh.revisionCount,
                  progress: fresh.progress,
                });
              }}
            />
          )}
        </div>
      )}
    </article>
  );
}

function MeetingDetail({ detail, onSaved }: { detail: MeetingResponseDetail; onSaved: (d: MeetingResponseDetail) => void }) {
  const rows: Array<Record<string, string>> = (() => {
    try {
      const parsed = JSON.parse(detail.scheduleRows || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  const objectives = formatPlanItemsAsText(detail.objectives);
  const scope = formatPlanItemsAsText(detail.scope);

  return (
    <>
      <div className="space-y-3 text-sm">
        {detail.address && (
          <p className="flex items-start gap-1.5 text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {detail.address}
          </p>
        )}
        {objectives && (
          <div>
            <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Objectives</h4>
            <p className="whitespace-pre-line">{objectives}</p>
          </div>
        )}
        {scope && (
          <div>
            <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Scope</h4>
            <p className="whitespace-pre-line">{scope}</p>
          </div>
        )}
        {rows.length > 0 && (
          <div>
            <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Agenda</h4>
            <ul className="space-y-1.5">
              {rows.map((r, i) => (
                <li key={i} className="rounded border border-border px-3 py-2 text-xs">
                  <span className="font-semibold">{[r.date, r.time].filter(Boolean).join(" · ")}</span>
                  {r.activity && <span className="block text-muted-foreground">{r.activity}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <ResponsesList detail={detail} />

      {detail.canRespond ? (
        <ResponseForm detail={detail} onSaved={onSaved} />
      ) : (
        <p className="rounded border border-dashed border-border p-3 text-xs text-muted-foreground">
          {detail.window.message ?? "Only people in this meeting's department can respond."}
        </p>
      )}
    </>
  );
}

function ResponsesList({ detail }: { detail: MeetingResponseDetail }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Department responses ({detail.responses.length}
        {detail.memberCount ? ` of ${detail.memberCount} members` : ""})
      </h4>
      {detail.responses.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nobody from the department has responded yet.</p>
      ) : (
        <ul className="space-y-2">
          {detail.responses.map((r: MeetingResponseItem) => (
            <li key={r.id} className="rounded border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {r.respondentName}
                  {r.mine && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
                </p>
                <ResponseStatusPill status={r.status} />
              </div>
              {r.concern ? (
                <div
                  className="prose prose-sm mt-2 max-w-none dark:prose-invert"
                  // Sanitised on the server before it was stored.
                  dangerouslySetInnerHTML={{ __html: r.concern }}
                />
              ) : (
                <p className="mt-1 text-xs italic text-muted-foreground">No concern noted.</p>
              )}
              <p className="mt-2 text-[10px] text-muted-foreground">
                {r.departmentName}
                {r.businessUnitName ? ` · ${r.businessUnitName}` : ""} · {new Date(r.updatedAt).toLocaleString("en-GB")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ResponseForm({ detail, onSaved }: { detail: MeetingResponseDetail; onSaved: (d: MeetingResponseDetail) => void }) {
  const mine = detail.myResponse;
  const [status, setStatus] = useState<MeetingResponseStatus>(mine?.status ?? "ACCEPTED");
  const [concern, setConcern] = useState(mine?.concern ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await clientApi(`/meeting-responses/meetings/${detail.id}/mine`, {
        method: "PUT",
        body: JSON.stringify({ status, concern }),
      });
      const fresh = await clientApi<MeetingResponseDetail>(`/meeting-responses/meetings/${detail.id}`);
      onSaved(fresh);
      setMessage({ ok: true, text: "Your response was saved. You can edit it until the meeting closes." });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Could not save your response." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {mine ? "Your response" : "Add your response"}
      </h4>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Your decision">
        {(["ACCEPTED", "REVISION_REQUESTED"] as MeetingResponseStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={status === s}
            onClick={() => setStatus(s)}
            className={`rounded-md border px-3 py-2.5 text-xs font-semibold transition-colors ${
              status === s
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold">
          Concern of the Department Owner {status === "REVISION_REQUESTED" ? "(required)" : "(optional)"}
        </label>
        <RichEditor value={concern} onChange={setConcern} editorClassName="min-h-[120px] max-h-[280px]" />
      </div>

      {message && (
        <p className={`text-xs ${message.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-600"}`}>{message.text}</p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {saving ? "Saving..." : mine ? "Update my response" : "Submit my response"}
      </button>
    </section>
  );
}
