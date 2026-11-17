/* Server-side "Export PDF". The browser sends the report it already rendered (the
   .plan-print-document markup plus the page's CSS); headless Chrome prints it with the same
   @media print / @page rules as Ctrl+P, so the PDF has real, selectable vector text, repeated
   table headers and the "OE-HB · label / Page X of Y" footer.

   Chrome comes from the `puppeteer` package: `npm install` downloads it into <repo>/.cache
   (see .puppeteerrc.cjs). If it is missing or fails, this route answers 503 and the browser
   falls back to its client-side image PDF (components/print/export-pdf.ts).

   Safety: only signed-in users may call it; page JavaScript is off; and the page can load
   nothing from the network - the app's own font/static files are served straight from
   .next/static on disk, every other request is aborted, so the HTML can't reach internal
   services. One print at a time, and the browser shuts down after a few idle minutes. */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readFile } from "fs/promises";
import { join, normalize, extname, sep } from "path";
import type { Browser } from "puppeteer";
import { AUTH_COOKIE } from "@/lib/apiClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";
const ASSET_HOST = "pdf.local"; // fake origin the page's relative URLs resolve against
const STATIC_DIR = join(process.cwd(), ".next", "static");
const MAX_BODY_BYTES = 20 * 1024 * 1024;
const IDLE_CLOSE_MS = 5 * 60 * 1000;

const MIME: Record<string, string> = {
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

let browserPromise: Promise<Browser> | null = null;
let idleTimer: NodeJS.Timeout | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b?.connected) return b;
    browserPromise = null;
  }
  browserPromise = (async () => {
    const puppeteer = (await import("puppeteer")).default;
    const opts = { headless: "shell" as const, args: ["--disable-dev-shm-usage", "--font-render-hinting=none"] };
    try {
      return await puppeteer.launch(opts);
    } catch {
      // Hosts that block unprivileged user namespaces (e.g. Ubuntu 24's AppArmor default) can't
      // start Chrome's sandbox. Page JS is off and all network access is blocked, see above.
      return await puppeteer.launch({ ...opts, args: [...opts.args, "--no-sandbox"] });
    }
  })();
  return browserPromise;
}

function scheduleIdleClose() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    const p = browserPromise;
    browserPromise = null;
    (await p?.catch(() => null))?.close().catch(() => {});
  }, IDLE_CLOSE_MS);
}

/** Text safe inside a CSS string literal. */
const cssString = (s: string) => s.replace(/[\\"\n\r]/g, " ").slice(0, 200);

async function isSignedIn(): Promise<boolean> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return false;
  const res = await fetch(`${BACKEND_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  }).catch(() => null);
  return !!res?.ok;
}

/** Class names copied from the app's <html>/<body> (they carry the next/font font variables). */
const safeClasses = (s: unknown) =>
  typeof s === "string" ? s.replace(/[^\w\-:/[\].% ]/g, "").split(/\s+/).filter((c) => c && c !== "dark").join(" ").slice(0, 500) : "";

async function render(
  html: string,
  css: string,
  label: string,
  landscape: boolean,
  htmlClass: string,
  bodyClass: string,
): Promise<Uint8Array> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", async (req) => {
      const url = new URL(req.url());
      if (url.protocol === "data:") return req.continue();
      if (url.host === ASSET_HOST && url.pathname.startsWith("/_next/static/")) {
        const rel = normalize(decodeURIComponent(url.pathname.slice("/_next/static/".length)));
        const file = join(STATIC_DIR, rel);
        if (file.startsWith(STATIC_DIR + sep)) {
          const body = await readFile(file).catch(() => null);
          if (body) {
            return req.respond({
              status: 200,
              contentType: MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
              // The page is about:blank and fonts load in CORS mode; without this they're refused.
              headers: { "Access-Control-Allow-Origin": "*" },
              body,
            });
          }
        }
      }
      return req.abort();
    });

    const doc = `<!doctype html><html class="${htmlClass}"><head><meta charset="utf-8"><base href="http://${ASSET_HOST}/">
<style>${css.replace(/<\/style/gi, "<\\/style")}</style>
<style>
  html { zoom: 1 !important; --app-zoom: 1 !important; }
  html, body { background: #fff !important; margin: 0; }
  .plan-print-root { display: block !important; }
  @page {
    size: A4 ${landscape ? "landscape" : "portrait"};
    margin: 14mm 12mm 16mm;
    @bottom-left { content: "OE-HB${label ? ` · ${cssString(label)}` : ""}"; font-size: 8pt; color: #666666; }
    @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 8pt; color: #666666; }
  }
</style></head><body class="${bodyClass}"><div class="plan-print-root">${html}</div></body></html>`;

    await page.setContent(doc, { waitUntil: "load", timeout: 20_000 });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    return await page.pdf({ preferCSSPageSize: true, printBackground: true, timeout: 30_000 });
  } finally {
    await page.close().catch(() => {});
  }
}

export async function POST(req: NextRequest) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ message: "Please sign in again." }, { status: 401 });
  }
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) {
    return NextResponse.json({ message: "This report is too large to export." }, { status: 413 });
  }
  const body = (await req.json().catch(() => null)) as
    | { html?: unknown; css?: unknown; label?: unknown; landscape?: unknown; fileName?: unknown; htmlClass?: unknown; bodyClass?: unknown }
    | null;
  if (!body || typeof body.html !== "string" || typeof body.css !== "string") {
    return NextResponse.json({ message: "Nothing to export." }, { status: 400 });
  }
  const label = typeof body.label === "string" ? body.label : "";
  const fileName = (typeof body.fileName === "string" && body.fileName.trim()) || "OE-HB report";

  // One print at a time: each one briefly needs a few hundred MB.
  const job = queue.then(() => render(
      body.html as string,
      body.css as string,
      label,
      body.landscape === true,
      safeClasses(body.htmlClass),
      safeClasses(body.bodyClass),
    ));
  queue = job.catch(() => undefined);
  try {
    const pdf = await job;
    scheduleIdleClose();
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="report.pdf"; filename*=UTF-8''${encodeURIComponent(`${fileName}.pdf`)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[pdf] server-side export failed:", err);
    scheduleIdleClose();
    return NextResponse.json(
      { message: "Server PDF export is unavailable. If Chrome is missing, run npm install (see README)." },
      { status: 503 },
    );
  }
}
