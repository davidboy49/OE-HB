/* "Export PDF": renders the on-page print report (.plan-print-document) straight to a PDF file and
   downloads it, so there is no print dialog or "Save as" step. The report is captured off-screen at
   the same width the print layout uses, cut into A4 pages (never through a table row, a kept block
   or a heading), and stamped with the same footer as Ctrl+P (label left, "Page X of Y" right).
   Ctrl+P still works and prints real selectable text through the @media print rules. */

const PX_PER_MM = 96 / 25.4;
const MARGIN = { x: 12, top: 14, bottom: 16 }; // mm, same as the @page rule
const SCALE = 2;

let busy = false;

export async function exportReportPdf(): Promise<void> {
  if (busy) return;
  const source = document.querySelector<HTMLElement>(".plan-print-root .plan-print-document");
  if (!source) return;
  busy = true;
  const previousCursor = document.body.style.cursor;
  document.body.style.cursor = "progress";
  try {
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

    // Off-screen copy at the print width, so wrapping matches the printed report.
    const host = document.createElement("div");
    host.style.cssText = `position:fixed;left:-100000px;top:0;width:${widthPx}px;background:#fff;`;
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
      const totalPx = host.scrollHeight;

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
