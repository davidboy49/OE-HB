import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/apiClient";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  const targetUrl = `${BACKEND_URL}/${path.join("/")}${req.nextUrl.search}`;

  const init: RequestInit = {
    method: req.method,
    headers: {
      // Pass the caller's own type through - a multipart upload (finding attachments) carries
      // its boundary in it. JSON stays the default for callers that don't set one.
      "Content-Type": req.headers.get("content-type") ?? "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    // Raw bytes, not text(): decoding a binary upload as UTF-8 would corrupt it.
    const body = await req.arrayBuffer();
    if (body.byteLength > 0) init.body = body;
  }

  const backendRes = await fetch(targetUrl, init);
  const contentType = backendRes.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = await backendRes.json().catch(() => null);
    return NextResponse.json(payload, { status: backendRes.status });
  }
  // Anything else (e.g. an attachment download) streams through untouched, with the headers
  // the browser needs to save it under its real name.
  const headers = new Headers();
  for (const name of ["content-type", "content-length", "content-disposition"]) {
    const value = backendRes.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new NextResponse(backendRes.body, { status: backendRes.status, headers });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  return proxy(req, (await params).path);
}
export async function POST(req: NextRequest, { params }: RouteContext) {
  return proxy(req, (await params).path);
}
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  return proxy(req, (await params).path);
}
export async function PUT(req: NextRequest, { params }: RouteContext) {
  return proxy(req, (await params).path);
}
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  return proxy(req, (await params).path);
}
