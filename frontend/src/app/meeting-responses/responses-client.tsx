"use client";

import { Fragment, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  MessageSquareWarning,
  MinusCircle,
  RefreshCw,
} from "lucide-react";
import type { AnnualPlan, DepartmentProgress, RollupPayload, RollupRow } from "@oeportal/shared";
import { clientApi } from "@/lib/apiClient";

const PILL =
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-850";

const PROGRESS: Record<DepartmentProgress, { label: string; icon: React.ReactNode }> = {
  AWAITING: { label: "Awaiting", icon: <Clock className="w-3.5 h-3.5 text-slate-400" /> },
  RESPONDED: { label: "Responded", icon: <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" /> },
  DONE: { label: "Done", icon: <CheckCircle2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" /> },
  MISSED: { label: "No response", icon: <MinusCircle className="w-3.5 h-3.5 text-slate-400" /> },
};

const stripHtml = (html: string) =>
  html
    .replace(/<\/(p|li|h[1-3]|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

/** One line per response; a meeting nobody answered still gets a line so gaps are visible. */
function buildCsv(rows: RollupRow[]): string {
  const header = [
    "OE Plan code", "Project", "Business Unit", "Department", "Meeting date", "Meeting state", "Department progress",
    "Respondent", "Email", "Decision", "Concern", "Responded at",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const m of rows) {
    const base = [
      m.projectCode, m.projectName, m.businessUnitName, m.departmentName, m.meetingDate,
      m.window.open ? "Open" : "Read-only", m.progress,
    ];
    if (m.responses.length === 0) {
      lines.push([...base, "", "", "", "", ""].map(csvCell).join(","));
      continue;
    }
    for (const r of m.responses) {
      lines.push(
        [...base, r.respondentName, r.respondentEmail, r.status, stripHtml(r.concern), new Date(r.updatedAt).toISOString()]
          .map(csvCell)
          .join(","),
      );
    }
  }
  return lines.join("\r\n");
}

export default function ResponsesClient({
  initialRollup,
  annualPlans,
}: {
  initialRollup: RollupPayload;
  annualPlans: AnnualPlan[];
}) {
  const [rollup, setRollup] = useState<RollupPayload>(initialRollup);
  const [annualPlanId, setAnnualPlanId] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planNames = useMemo(() => new Map(annualPlans.map((p) => [p.id, p.planName])), [annualPlans]);

  const load = async (planId: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = planId ? `?annualPlanId=${encodeURIComponent(planId)}` : "";
      setRollup(await clientApi<RollupPayload>(`/meeting-responses/rollup${qs}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the overview.");
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    const blob = new Blob(["﻿" + buildCsv(rollup.meetings)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `department-responses-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const s = rollup.summary;
  const tiles = [
    { label: "Released meetings", value: s.total },
    { label: "Open for response", value: s.open },
    { label: "Done", value: s.done },
    { label: "No response (read-only)", value: s.missed },
    { label: "With revision requests", value: s.withRevisionRequests },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Department Responses</h1>
          <p className="mt-1 max-w-2xl text-xs text-slate-500">
            A department is <strong>done</strong> once its meeting is read-only and at least one person from the department
            responded. Meetings become read-only after their date, or when the OE Plan is closed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={annualPlanId}
            onChange={(e) => {
              setAnnualPlanId(e.target.value);
              void load(e.target.value);
            }}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
            aria-label="Filter by Annual Plan"
          >
            <option value="">All Annual Plans</option>
            {annualPlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.planName} ({p.period})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void load(annualPlanId)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={rollup.meetings.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#05375c] px-3 py-2 text-xs font-bold text-white hover:bg-[#074776] disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t.value}</p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">{t.label}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-sans font-bold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
            <tr>
              <th className="px-4 py-3">OE Plan</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">BU / Department</th>
              <th className="px-4 py-3">Meeting date</th>
              <th className="px-4 py-3">Responses</th>
              <th className="px-4 py-3">Progress</th>
              <th className="w-10 px-2 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {rollup.meetings.map((m) => {
              const p = PROGRESS[m.progress];
              const isOpen = expanded === m.id;
              return (
                <Fragment key={m.id}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : m.id)}
                    className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/20"
                  >
                    <td className="px-4 py-3 font-mono font-semibold">{m.projectCode}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{m.projectName}</div>
                      {m.annualPlanId && <div className="text-[10px] text-slate-400">{planNames.get(m.annualPlanId)}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {m.departmentName}
                      {m.businessUnitName && <div className="text-[10px] text-slate-400">{m.businessUnitName}</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{m.meetingDate || "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {m.responseCount}
                      {m.memberCount ? ` of ${m.memberCount}` : ""}
                      {m.revisionCount > 0 && (
                        <span className="ml-2 inline-flex items-center gap-1 text-slate-500" title="Revision requests">
                          <MessageSquareWarning className="h-3 w-3" /> {m.revisionCount}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={PILL}>
                        {p.icon}
                        {p.label}
                      </span>
                      {!m.window.open && m.window.message && <div className="mt-1 text-[10px] text-slate-400">Read-only</div>}
                    </td>
                    <td className="px-2 py-3 text-slate-400">
                      <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={7} className="bg-slate-50/60 px-6 py-4 dark:bg-slate-900/40">
                        {m.responses.length === 0 ? (
                          <p className="text-slate-500">Nobody from this department has responded.</p>
                        ) : (
                          <ul className="space-y-3">
                            {m.responses.map((r) => (
                              <li key={r.id} className="rounded border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <span className="font-semibold">{r.respondentName}</span>
                                    <span className="ml-2 text-slate-400">{r.respondentEmail}</span>
                                  </div>
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
                                  <p className="mt-1 italic text-slate-400">No concern noted.</p>
                                )}
                                <p className="mt-2 text-[10px] text-slate-400">
                                  {r.departmentName}
                                  {r.businessUnitName ? ` · ${r.businessUnitName}` : ""} · {new Date(r.updatedAt).toLocaleString("en-GB")}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rollup.meetings.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No released Open Meetings yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
