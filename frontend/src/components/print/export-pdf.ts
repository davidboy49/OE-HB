/* "Export PDF": downloads the on-page print report (.plan-print-document) as a PDF file, with no
   print dialog or "Save as" step.

   First choice is the server (POST /api/pdf): it prints the same markup and CSS with headless
   Chrome, giving real selectable vector text exactly like Ctrl+P. If that fails (Chrome not
   installed, server busy or down), it falls back to the client-side image PDF below.

   Fallback: the report is captured off-screen at
   the same width the print layout uses, cut into A4 pages (never through a table row, a kept block
   or a heading), and stamped with the same footer as Ctrl+P (label left, "Page X of Y" right).
   Ctrl+P still works and prints real selectable text through the @media print rules. */

const PX_PER_MM = 96 / 25.4;
const MARGIN = { x: 12, top: 14, bottom: 16 }; // mm, same as the @page rule
const SCALE = 2;

let busy = false;

/** Every stylesheet on the page as text, with relative url(...)s (fonts) made root-relative so they
    still resolve once the CSS is inlined into a different document. */
function collectCss(): string {
  const parts: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin sheet (none expected)
    }
    let text = Array.from(rules, (r) => r.cssText).join("\n");
    if (sheet.href) {
      const base = sheet.href;
      text = text.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q: string, ref: string) => {
        if (/^(data:|#|[a-z][a-z0-9+.-]*:\/\/)/i.test(ref)) return m;
        const u = new URL(ref, base);
        return u.origin === location.origin ? `url(${q}${u.pathname}${q})` : m;
      });
    }
    parts.push(text);
  }
  return parts.join("\n");
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Vector PDF from the server. Returns false when it isn't available, so the caller falls back. */
async function exportViaServer(source: HTMLElement, fileName: string, label: string, landscape: boolean): Promise<boolean> {
  try {
    const res = await fetch("/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html: source.outerHTML,
        css: collectCss(),
        label,
        landscape,
        fileName,
        htmlClass: document.documentElement.className,
        bodyClass: document.body.className,
      }),
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("application/pdf")) {
      console.warn("Server PDF export unavailable, using the image PDF instead.", res.status);
      return false;
    }
    downloadBlob(await res.blob(), `${fileName}.pdf`);
    return true;
  } catch (err) {
    console.warn("Server PDF export failed, using the image PDF instead.", err);
    return false;
  }
}

export async function exportReportPdf(): Promise<void> {
  if (busy) return;
  const source = document.querySelector<HTMLElement>(".plan-print-root .plan-print-document");
  if (!source) return;
  busy = true;
  const previousCursor = document.body.style.cursor;
  document.body.style.cursor = "progress";
  try {
    if (
      await exportViaServer(
        source,
        source.dataset.fileName || "OE-HB report",
        source.dataset.footerLabel ?? "",
        source.dataset.landscape === "true",
      )
    ) {
      return;
    }
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);

    const landscape = source.dataset.landscape === "true";
    const label = source.dataset.footerLabel ?? "";
    const fileName = source.dataset.fileName || "OE-HB report";

    const pageW = landscape ? 297 : 210;
    const pageH = landscape ? 210 : 297;
    const contentWmm = pageW - MARGIN.x * 2;
    const contentHmm = pageH - MARGIN.top - MARGIN.bottom;
    const widthPx = Math.round(contentWmm * PX_PER_MM);
    const pageHPx = contentHmm * PX_PER_MM;

    // Off-screen copy at the print width, so wrapping matches the printed report. Absolute, not
    // fixed: a fixed element is captured only as tall as the window, which cut long reports off.
    const host = document.createElement("div");
    host.style.cssText = `position:absolute;left:-100000px;top:0;width:${widthPx}px;background:#fff;`;
    // The app zooms the page to 110% (zoom on <html>). Undo it on the copy: html2canvas lays words
    // out at zoomed positions but draws them unzoomed, which left gaps between words and measured
    // the report too short, cutting off its last rows.
    const pageZoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    host.style.zoom = String(1 / pageZoom);
    const clone = source.cloneNode(true) as HTMLElement;
    host.appendChild(clone);
    document.body.appendChild(host);

    try {
      await document.fonts?.ready;
      const top = host.getBoundingClientRect().top;
      const rect = (el: Element, extra = 0): [number, number] => {
        const r = el.getBoundingClientRect();
        return [r.top - top, r.bottom - top + extra];
      };
      // Spans a page break must not cut through: rows, kept blocks, figures, and a heading together
      // with the first lines after it.
      const blocks = [
        ...Array.from(clone.querySelectorAll("tr, .print-keep, img, svg")).map((el) => rect(el)),
        ...Array.from(clone.querySelectorAll("h2, h3")).map((el) => rect(el, 36)),
      ];
      const totalPx = Math.ceil(host.getBoundingClientRect().height);

      const cuts: number[] = [0];
      while (totalPx - cuts[cuts.length - 1] > pageHPx + 1) {
        const start = cuts[cuts.length - 1];
        let cut = start + pageHPx;
        for (let i = 0; i < 12; i++) {
          const hit = blocks.find(([t, b]) => t < cut - 0.5 && b > cut + 0.5 && t > start);
          if (!hit) break;
          cut = hit[0];
        }
        // A block taller than the page can't be kept whole: cut where the page ends.
        if (cut - start < pageHPx * 0.3) cut = start + pageHPx;
        cuts.push(cut);
      }
      cuts.push(totalPx);

      const scale = Math.min(SCALE, 30000 / totalPx);
      const canvas = await html2canvas(host, {
        scale,
        backgroundColor: "#ffffff",
        windowWidth: widthPx,
        windowHeight: Math.max(window.innerHeight, Math.ceil(totalPx)),
        useCORS: true,
        logging: false,
      });

      const pdf = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: "a4", compress: true });
      pdf.setProperties({ title: fileName });
      const pages = cuts.length - 1;
      for (let p = 0; p < pages; p++) {
        const sy = Math.round(cuts[p] * scale);
        const sh = Math.max(1, Math.round((cuts[p + 1] - cuts[p]) * scale));
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = sh;
        const ctx = slice.getContext("2d");
        if (!ctx) throw new Error("Canvas is not available.");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);

        if (p > 0) pdf.addPage("a4", landscape ? "landscape" : "portrait");
        pdf.addImage(slice.toDataURL("image/png"), "PNG", MARGIN.x, MARGIN.top, contentWmm, ((cuts[p + 1] - cuts[p]) / PX_PER_MM));
        pdf.setFontSize(8);
        pdf.setTextColor(102);
        pdf.text(label ? `OE-HB · ${label}` : "OE-HB", MARGIN.x, pageH - 8);
        pdf.text(`Page ${p + 1} of ${pages}`, pageW - MARGIN.x, pageH - 8, { align: "right" });
      }
      pdf.save(`${fileName}.pdf`);
    } finally {
      host.remove();
    }
  } catch (err) {
    console.error("PDF export failed", err);
    window.alert("Could not create the PDF. Please try again.");
  } finally {
    document.body.style.cursor = previousCursor;
    busy = false;
  }
}
