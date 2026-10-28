"use client";

import type { PlanItem } from "@oeportal/shared";
import RichTextView from "@/components/ui/rich-text-view";
import {
  MUTED,
  cell,
  th,
  fmt,
  hasText,
  Section,
  SubHeading,
  ItemTable,
  Empty,
  ReportHeader,
  FigureRow,
  DetailsTable,
  PrintFooterLabel,
  usePrintFileName,
} from "./print-kit";

export interface SessionPrintRow {
  day: string;
  date: string;
  time: string;
  scope: { id: string; text: string }[];
  dataRequests: { id: string; text: string }[];
  activity: string;
  conductBy: string;
  pIncharge: string;
}

export interface SessionPrintData {
  /** "Execution Schedule" / "Open Meeting" */
  kind: string;
  title: string;
  statusLabel: string;
  figures: [string, string][];
  details: [string, string][];
  objectives: PlanItem[];
  scopeItems: PlanItem[];
  /** Omit for documents with no row table (Open Meeting). */
  rowsHeading?: string;
  rows?: SessionPrintRow[];
  attendees?: { name: string; status: string }[];
}

const mono: React.CSSProperties = { fontFamily: "var(--font-mono, monospace)", fontSize: 9 };

function IdText({ items, missing }: { items: { id: string; text: string }[]; missing: string }) {
  if (items.length === 0) return <span style={{ color: MUTED }}>None</span>;
  return (
    <>
      {items.map((it, i) => (
        <div key={it.id} style={{ marginTop: i === 0 ? 0 : 5 }}>
          <div style={mono}>{it.id}</div>
          <div>{it.text || <span style={{ color: MUTED, fontStyle: "italic" }}>{missing}</span>}</div>
        </div>
      ))}
    </>
  );
}

export default function SessionPrintDocument({ data }: { data: SessionPrintData }) {
  usePrintFileName([data.title.replace(/\s·\s/g, " - "), data.kind]);
  return (
    <div className="plan-print-document" style={{ color: "#1a1a1a", fontSize: 10.5, lineHeight: 1.5, fontFamily: "var(--font-sans, Arial, sans-serif)" }}>
      <PrintFooterLabel label={data.kind} />
      <ReportHeader
        eyebrow={data.kind}
        title={data.title}
        meta={[`Status: ${data.statusLabel}`, `Printed ${fmt(new Date().toISOString())}`]}
      />

      <FigureRow figures={data.figures} />

      <Section title="Details">
        <DetailsTable pairs={data.details} />
      </Section>

      <Section title="Objectives and scope">
        <SubHeading>Objectives</SubHeading>
        <ItemTable idHeader="ID" textHeader="Objective" rows={data.objectives.map((o) => ({ id: o.id, text: o.text }))} />
        <SubHeading>Scope</SubHeading>
        <ItemTable idHeader="ID" textHeader="Scope" rows={data.scopeItems.map((o) => ({ id: o.id, text: o.text }))} />
      </Section>

      {data.rows && (
      <Section title={data.rowsHeading ?? "Rows"}>
        {data.rows.length === 0 ? (
          <Empty text="No rows yet." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={{ ...th, width: "7%" }}>Day</th>
                <th style={{ ...th, width: "14%" }}>Date</th>
                <th style={{ ...th, width: "9%" }}>Time</th>
                <th style={{ ...th, width: "21%" }}>OE scope</th>
                <th style={th}>Activities, data and documents to request</th>
                <th style={{ ...th, width: "11%" }}>Conduct by</th>
                <th style={{ ...th, width: "11%" }}>P. in charge</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={i}>
                  <td style={cell}>{r.day}</td>
                  <td style={{ ...cell, fontWeight: 600 }}>{r.date}</td>
                  <td style={cell}>{r.time}</td>
                  <td style={cell}>
                    <IdText items={r.scope} missing="Scope text not found" />
                  </td>
                  <td style={cell}>
                    {r.dataRequests.length > 0 && <IdText items={r.dataRequests} missing="Data request text not found" />}
                    {hasText(r.activity) && (
                      <div style={{ marginTop: r.dataRequests.length > 0 ? 6 : 0 }}>
                        <RichTextView value={r.activity} />
                      </div>
                    )}
                    {r.dataRequests.length === 0 && !hasText(r.activity) && <span style={{ color: MUTED }}>—</span>}
                  </td>
                  <td style={{ ...cell, whiteSpace: "pre-wrap" }}>{r.conductBy || "—"}</td>
                  <td style={{ ...cell, whiteSpace: "pre-wrap" }}>{r.pIncharge || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      )}

      {data.attendees && data.attendees.length > 0 && (
        <Section title="Attendees">
          <table className="print-keep" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={{ ...th, width: "30%" }}>Confirmation</th>
              </tr>
            </thead>
            <tbody>
              {data.attendees.map((a) => (
                <tr key={a.name}>
                  <td style={cell}>{a.name}</td>
                  <td style={cell}>{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
}
