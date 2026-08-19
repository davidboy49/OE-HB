import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/apiClient";

// Routes reachable without a session - /meetings/scan is the QR-code consent flow,
// meant to be opened by an external auditee with no AuditDesk account. /api/backend
// is excluded entirely: it's the client-side fetch proxy, not a page - redirecting
// a fetch() call to a login HTML page would break every client component's error
// handling, not just the QR flow. The backend's own JwtAuthGuard (401) is the real
// auth boundary for API calls; this middleware only gates page navigation.
const PUBLIC_PATHS = ["/login", "/api/session", "/api/backend", "/meetings/scan"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isPublic) return NextResponse.next();

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
