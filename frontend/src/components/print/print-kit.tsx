"use client";

import { Fragment, useEffect } from "react";
import RichTextView from "@/components/ui/rich-text-view";

/* Building blocks shared by the printed reports (Individual OE Plan, Execution Schedule, Open
   Meeting, OE Findings). Plain black, grey and white: structure comes from weight, spacing and
   hairline rules, so a report reads the same on any printer or photocopy. */

export const INK = "#1a1a1a";
export const MUTED = "#666666";
export const LINE = "#d0d0d0";

export const fmt = (d?: string | null) =>
  d && !isNaN(new Date(d).getTime())
    ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "";
export const fmtShort = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export const hasText = (html?: string | null) => !!html && html.replace(/<[^>]*>/g, "").trim().length > 0;
export const dash = (v: string) => v || "—";

export const cell: React.CSSProperties = { border: `0.5px solid ${LINE}`, padding: "4px 7px", verticalAlign: "top", textAlign: "left" };
export const th: React.CSSProperties = { ...cell, fontWeight: 600 };

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
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

export function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 10.5, fontWeight: 700, margin: "10px 0 4px", color: INK }}>{children}</h3>;
}

export function Empty({ text = "Not provided." }: { text?: string }) {
  return <p style={{ margin: 0, color: MUTED, fontStyle: "italic" }}>{text}</p>;
}

export function ItemTable({
  idHeader,
  textHeader,
  rows,
}: {
  idHeader: string;
  textHeader: string;
  rows: { id: string; text: string; note?: string }[];
}) {
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

export function Rich({ html }: { html?: string | null }) {
  return hasText(html) ? <RichTextView value={html as string} /> : <Empty />;
}

/** Title block: small caps eyebrow, the title, and a right-aligned meta note. */
export function ReportHeader({ eyebrow, title, meta }: { eyebrow: string; title: string; meta: string[] }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: `2px solid ${INK}`, paddingBottom: 8 }}>
      <div>
        <div style={{ fontSize: 9.5, letterSpacing: "0.1em", color: MUTED, textTransform: "uppercase" }}>{eyebrow}</div>
        <div style={{ fontSize: 19, fontWeight: 600, marginTop: 2 }}>{title}</div>
      </div>
      <div style={{ textAlign: "right", fontSize: 9.5, color: MUTED }}>
        {meta.map((line, i) => (
          <Fragment key={i}>
            {i > 0 && <br />}
            {line}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/** Row of outlined key-figure boxes. */
export function FigureRow({ figures }: { figures: [string, string][] }) {
  return (
    <div style={{ display: "flex", gap: 8, margin: "12px 0 0" }} className="print-keep">
      {figures.map(([label, value]) => (
        <div key={label} style={{ flex: "1 1 0", border: `0.5px solid ${LINE}`, padding: "7px 10px", minWidth: 0 }}>
          <div style={{ fontSize: 9, color: MUTED }}>{label}</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

/** Label/value pairs laid out two to a line. */
export function DetailsTable({ pairs }: { pairs: [string, string][] }) {
  const lines = Array.from({ length: Math.ceil(pairs.length / 2) }, (_, i) => pairs.slice(i * 2, i * 2 + 2));
  return (
    <table className="print-keep" style={{ width: "100%", borderCollapse: "collapse" }}>
      <tbody>
        {lines.map((line, i) => (
          <tr key={i}>
            {line.map(([label, value]) => (
              <Fragment key={label}>
                <th style={{ ...th, width: "17%" }}>{label}</th>
                <td style={{ ...cell, width: "33%" }}>{value}</td>
              </Fragment>
            ))}
            {line.length === 1 && <td colSpan={2} style={cell} />}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Names this report in the page footer ("OE-HB · <label>"); the page number is global. Only
    exists while the report is mounted, so each page prints its own label. */
export function PrintFooterLabel({ label }: { label: string }) {
  return (
    <style>{`@media print { @page { @bottom-left { content: "OE-HB · ${label}"; font-size: 8pt; color: #666666; } } }`}</style>
  );
}

/** "Save as PDF" suggests the page title as the file name, so while a report is mounted the title
    becomes "<parts> - <date>" for the duration of the print (Export PDF button and Ctrl+P alike),
    then goes back. Characters a file name can't hold are replaced. */
export function usePrintFileName(parts: string[]) {
  const name = [...parts, new Date().toISOString().slice(0, 10)]
    .filter(Boolean)
    .join(" - ")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  useEffect(() => {
    const original = document.title;
    const set = () => {
      document.title = name;
    };
    const restore = () => {
      document.title = original;
    };
    window.addEventListener("beforeprint", set);
    window.addEventListener("afterprint", restore);
    return () => {
      window.removeEventListener("beforeprint", set);
      window.removeEventListener("afterprint", restore);
      document.title = original;
    };
  }, [name]);
}

/** Switches the printed page to A4 landscape for as long as the report is mounted - for reports
    with a table too wide for portrait. */
export function PrintLandscape() {
  return <style>{`@media print { @page { size: A4 landscape; } }`}</style>;
}
