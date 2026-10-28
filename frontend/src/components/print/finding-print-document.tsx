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
  PrintLandscape,
  usePrintFileName,
} from "./print-kit";

export interface FindingPrintLine {
  no: number;
  scope: { id: string; text: string } | null;
  severity: string;
  date: string;
  reportedBy: string;
  finding: string;
  implication: string;
  recommendation: string;
  /** "Pending" | "In progress" | "Completed" */
  status: string;
  /** Planned completion date, shown while the line is in progress. */
  due: string;
  attachments: string[];
}

export interface FindingPrintData {
  title: string;
  statusLabel: string;
  figures: [string, string][];
  details: [string, string][];
  objectives: PlanItem[];
  scopeItems: PlanItem[];
  lines: FindingPrintLine[];
}

const small: React.CSSProperties = { fontSize: 9, color: MUTED };

function Cell({ html }: { html: string }) {
  return hasText(html) ? <RichTextView value={html} /> : <span style={{ color: MUTED }}>—</span>;
}

export default function FindingPrintDocument({ data }: { data: FindingPrintData }) {
  usePrintFileName([data.title.replace(/\s·\s/g, " - "), "OE Findings Report"]);
  return (
    <div className="plan-print-document" style={{ color: "#1a1a1a", fontSize: 10.5, lineHeight: 1.5, fontFamily: "var(--font-sans, Arial, sans-serif)" }}>
      <PrintFooterLabel label="OE Findings Report" />
      <PrintLandscape />
      <ReportHeader
        eyebrow="OE Findings Report"
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

      <Section title="Findings">
        {data.lines.length === 0 ? (
          <Empty text="No finding line items recorded in this report." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={{ ...th, width: "5%" }}>No</th>
                <th style={{ ...th, width: "19%" }}>Linked OE scope</th>
                <th style={{ ...th, width: "30%" }}>Finding and observations</th>
                <th style={{ ...th, width: "17%" }}>Implication</th>
                <th style={{ ...th, width: "17%" }}>Recommendation</th>
                <th style={{ ...th, width: "12%" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((l) => (
                <tr key={l.no}>
                  <td style={cell}>{l.no}</td>
                  <td style={cell}>
                    {l.scope ? (
                      <>
                        <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 9 }}>{l.scope.id}</div>
                        <div>{l.scope.text || <span style={{ color: MUTED, fontStyle: "italic" }}>Scope text not found</span>}</div>
                      </>
                    ) : (
                      <span style={{ color: MUTED }}>—</span>
                    )}
                  </td>
                  <td style={cell}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>
                      {[l.severity, l.date, l.reportedBy && `by ${l.reportedBy}`].filter(Boolean).join(" · ")}
                    </div>
                    <Cell html={l.finding} />
                    {l.attachments.length > 0 && <div style={{ ...small, marginTop: 4 }}>Attachments: {l.attachments.join(", ")}</div>}
                  </td>
                  <td style={cell}>
                    <Cell html={l.implication} />
                  </td>
                  <td style={cell}>
                    <Cell html={l.recommendation} />
                  </td>
                  <td style={cell}>
                    <div style={{ fontWeight: 600 }}>{l.status}</div>
                    {l.due && l.status !== "Completed" && <div style={small}>Due {fmt(l.due) || l.due}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
