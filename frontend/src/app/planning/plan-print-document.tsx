"use client";

import { Fragment } from "react";
import type { PlanItem } from "@oeportal/shared";
import RichTextView from "@/components/ui/rich-text-view";

export interface PlanPrintData {
  code: string;
  name: string;
  statusLabel: string;
  businessUnit: string;
  departments: string[];
  leader: string;
  members: string[];
  deptPics: string[];
  annualPlan: string;
  project: string;
  startDate: string;
  endDate: string;
  objectives: PlanItem[];
  scopeItems: { item: PlanItem; addedForPlan: boolean }[];
  riskProcess: string;
  riskClass: string;
  opEx: string;
  dataRequestItems: PlanItem[];
  focusArea: string;
  timeline: {
    presentation: string;
    notification: string;
    fieldWorkStart: string;
    fieldWorkEnd: string;
    findingReportOffset: number;
    finalReportOffset: number;
  };
  outcome: string;
  preparedBy: { name: string; title: string; date: string };
  approvedBy: { name: string; title: string; date: string };
}

const INK = "#1a1a1a";
const MUTED = "#666666";
const LINE = "#d0d0d0";

const fmt = (d?: string | null) =>
  d && !isNaN(new Date(d).getTime())
    ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "";
const fmtShort = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

// Same arithmetic as the editor so the printed dates match the screen.
const addDays = (base: string, days: number) => {
  if (!base) return "";
  const d = new Date(base);
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

const hasText = (html: string) => !!html && html.replace(/<[^>]*>/g, "").trim().length > 0;
const dash = (v: string) => v || "—";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 18 }}>
      <h2
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: INK,
          borderBottom: `1px solid ${INK}`,
          paddingBottom: 3,
          margin: "0 0 8px",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 10.5, fontWeight: 700, margin: "10px 0 4px", color: "#1a1a1a" }}>{children}</h3>;
}

function Empty() {
  return <p style={{ margin: 0, color: MUTED, fontStyle: "italic" }}>Not provided.</p>;
}

const cell: React.CSSProperties = { border: `0.5px solid ${LINE}`, padding: "4px 7px", verticalAlign: "top", textAlign: "left" };
const th: React.CSSProperties = { ...cell, fontWeight: 600 };

function ItemTable({ idHeader, textHeader, rows }: { idHeader: string; textHeader: string; rows: { id: string; text: string; note?: string }[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={{ ...th, width: "16%" }}>{idHeader}</th>
          <th style={th}>{textHeader}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td style={{ ...cell, fontFamily: "var(--font-mono, monospace)", fontSize: 9.5 }}>{r.id}</td>
            <td style={cell}>
              {r.text || <span style={{ color: MUTED, fontStyle: "italic" }}>No content entered.</span>}
              {r.note && <div style={{ color: MUTED, fontSize: 9, marginTop: 2 }}>{r.note}</div>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Rich({ html }: { html: string }) {
  return hasText(html) ? <RichTextView value={html} /> : <Empty />;
}

export default function PlanPrintDocument({ data }: { data: PlanPrintData }) {
  const t = data.timeline;
  const findingReport = t.fieldWorkEnd ? addDays(t.fieldWorkEnd, t.findingReportOffset) : "";
  const finalReport = findingReport ? addDays(findingReport, t.finalReportOffset) : "";
  const fieldSpan =
    t.fieldWorkStart && t.fieldWorkEnd
      ? Math.round((new Date(t.fieldWorkEnd).getTime() - new Date(t.fieldWorkStart).getTime()) / 86400000)
      : null;
  const fieldDays = fieldSpan !== null && fieldSpan >= 0 ? fieldSpan + 1 : null;

  const chartRows = [
    { key: "pres", label: "Planning presentation", start: t.presentation, end: t.presentation, color: "#a3a3a3" },
    { key: "notify", label: "Notify department", start: t.notification, end: t.notification, color: "#a3a3a3" },
    {
      key: "field",
      label: "Field work",
      start: t.fieldWorkStart || t.fieldWorkEnd,
      end: t.fieldWorkEnd || t.fieldWorkStart,
      color: "#1a1a1a",
    },
    { key: "finding", label: "Finding report", start: findingReport, end: findingReport, color: "#595959" },
    { key: "final", label: "Final report", start: finalReport, end: finalReport, color: "#595959" },
  ].filter((r) => r.start);
  const times = chartRows.flatMap((r) => [new Date(r.start).getTime(), new Date(r.end).getTime()]).filter((x) => !isNaN(x));
  const min = times.length ? Math.min(...times) : 0;
  const span = (times.length ? Math.max(...times) : 0) - min;
  const pct = (d: string) => ((new Date(d).getTime() - min) / span) * 100;

  const timelineRows: [string, string][] = [
    ["Planning presentation", fmt(t.presentation)],
    ["Notify department", fmt(t.notification)],
    ["Field work", t.fieldWorkStart || t.fieldWorkEnd ? `${fmt(t.fieldWorkStart) || "—"} to ${fmt(t.fieldWorkEnd) || "—"}` : ""],
    ["Finding report", fmt(findingReport)],
    ["Final report", fmt(finalReport)],
  ];

  const keyFigures: [string, string][] = [
    ["Field work", fieldDays !== null ? `${fieldDays} day${fieldDays === 1 ? "" : "s"}` : "—"],
    ["Finding report", findingReport ? fmt(findingReport) : "—"],
    ["Final report", finalReport ? fmt(finalReport) : "—"],
    ["OE leader", data.leader || "—"],
  ];

  const details: [string, string][] = [
    ["Business unit", dash(data.businessUnit)],
    ["Department", dash(data.departments.join(", "))],
    ["OE leader", dash(data.leader)],
    ["Team members", dash(data.members.join(", "))],
    ["Department PIC", dash(data.deptPics.join(", "))],
    ["Annual plan", dash(data.annualPlan)],
    ["Project", dash(data.project)],
    ["Plan period", data.startDate || data.endDate ? `${fmt(data.startDate) || "—"} to ${fmt(data.endDate) || "—"}` : "—"],
  ];

  return (
    <div className="plan-print-document" style={{ color: "#1a1a1a", fontSize: 10.5, lineHeight: 1.5, fontFamily: "var(--font-sans, Arial, sans-serif)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: `2px solid ${INK}`, paddingBottom: 8 }}>
        <div>
          <div style={{ fontSize: 9.5, letterSpacing: "0.1em", color: MUTED, textTransform: "uppercase" }}>Operational Excellence Plan</div>
          <div style={{ fontSize: 19, fontWeight: 600, marginTop: 2 }}>
            {data.code} · {data.name}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 9.5, color: MUTED }}>
          Status: {data.statusLabel}
          <br />
          Printed {fmt(new Date().toISOString())}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, margin: "12px 0 0" }} className="print-keep">
        {keyFigures.map(([label, value]) => (
          <div key={label} style={{ flex: "1 1 0", border: `0.5px solid ${LINE}`, padding: "7px 10px", minWidth: 0 }}>
            <div style={{ fontSize: 9, color: MUTED }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
          </div>
        ))}
      </div>

      <Section title="Plan details">
        <table className="print-keep" style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {Array.from({ length: Math.ceil(details.length / 2) }, (_, i) => details.slice(i * 2, i * 2 + 2)).map((pair, i) => (
              <tr key={i}>
                {pair.map(([label, value]) => (
                  <Fragment key={label}>
                    <th style={{ ...th, width: "17%" }}>{label}</th>
                    <td style={{ ...cell, width: "33%" }}>{value}</td>
                  </Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="I. Objectives and scope">
        <SubHeading>1.1 Objectives</SubHeading>
        <ItemTable idHeader="ID" textHeader="Objective" rows={data.objectives.map((o) => ({ id: o.id, text: o.text }))} />
        <SubHeading>1.2 Scope</SubHeading>
        <ItemTable
          idHeader="ID"
          textHeader="Scope"
          rows={data.scopeItems.map(({ item, addedForPlan }) => ({
            id: item.id,
            text: item.text,
            note: addedForPlan ? "Added for this plan" : undefined,
          }))}
        />
      </Section>

      <Section title="II. Map risk to department in charge">
        <SubHeading>Risk meets company process</SubHeading>
        <Rich html={data.riskProcess} />
        <SubHeading>Classify risk based on potential impact</SubHeading>
        <Rich html={data.riskClass} />
      </Section>

      <Section title="III. Operational excellence technique and approach">
        <SubHeading>Obtain data error to fieldwork mapping</SubHeading>
        <Rich html={data.opEx} />
      </Section>

      <Section title="IV. Data and documents to request">
        <ItemTable idHeader="ID" textHeader="Data or document" rows={data.dataRequestItems.map((o) => ({ id: o.id, text: o.text }))} />
        <SubHeading>Areas to focus on</SubHeading>
        <Rich html={data.focusArea} />
      </Section>

      <Section title="V. Operational excellence timeline">
        <table className="print-keep" style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {timelineRows.map(([label, value]) => (
              <tr key={label}>
                <th style={{ ...th, width: "28%" }}>{label}</th>
                <td style={cell}>{value || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {span > 0 && (
          <div className="print-keep" style={{ marginTop: 10, border: `0.5px solid ${LINE}`, padding: "8px 10px" }}>
            {chartRows.map((row) => {
              const left = pct(row.start);
              const right = pct(row.end);
              return (
                <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 10, height: 22 }}>
                  <span style={{ width: 120, flexShrink: 0, fontSize: 9.5 }}>{row.label}</span>
                  <div style={{ position: "relative", flex: "1 1 0", height: 22, minWidth: 0 }}>
                    <div style={{ position: "absolute", left: 0, right: 0, top: "50%", borderTop: `0.5px solid ${LINE}` }} />
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        height: 9,
                        transform: "translateY(-50%)",
                        borderRadius: 2,
                        background: row.color,
                        left: `${left}%`,
                        width: `max(${Math.max(right - left, 0)}%, 6px)`,
                      }}
                    />
                  </div>
                  <span style={{ width: 92, flexShrink: 0, fontSize: 9, color: MUTED, textAlign: "right" }}>
                    {row.end !== row.start ? `${fmtShort(row.start)} - ${fmtShort(row.end)}` : fmtShort(row.start)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="VI. Expected outcomes">
        <Rich html={data.outcome} />
      </Section>

      <Section title="Sign-off">
        <table className="print-keep" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, width: "18%" }} />
              <th style={th}>Name</th>
              <th style={th}>Title</th>
              <th style={{ ...th, width: "16%" }}>Date</th>
              <th style={{ ...th, width: "22%" }}>Signature</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ["Prepared by", data.preparedBy],
                ["Approved by", data.approvedBy],
              ] as const
            ).map(([label, p]) => (
              <tr key={label}>
                <th style={{ ...th, height: 38 }}>{label}</th>
                <td style={cell}>{p.name}</td>
                <td style={cell}>{p.title}</td>
                <td style={cell}>{fmt(p.date) || p.date}</td>
                <td style={cell} />
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
