import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/apiClient";
import { safeReturnPath } from "@/lib/return-path";
import { SSO_COOKIE, getSsoConfig, redirectUri, type SsoTransaction } from "@/lib/sso";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

function failure(req: NextRequest, message: string) {
  const url = new URL("/login", req.url);
  url.searchParams.set("ssoError", message);
  const res = NextResponse.redirect(url);
  res.cookies.delete({ name: SSO_COOKIE, path: "/api/session/sso" });
  return res;
}

/** Step 2: Keycloak sends the browser back here with a one-time code. */
export async function GET(req: NextRequest) {
  const sso = getSsoConfig();
  if (!sso) return failure(req, "SSO is not configured");

  const params = req.nextUrl.searchParams;
  if (params.get("error")) {
    return failure(req, params.get("error_description") ?? "Sign-in was cancelled");
  }

  let txn: SsoTransaction | null = null;
  try {
    txn = JSON.parse(req.cookies.get(SSO_COOKIE)?.value ?? "null");
  } catch {
    txn = null;
  }
  const code = params.get("code");
  // The state we issued must come back unchanged - otherwise this callback was not started by us.
  if (!txn || !code || params.get("state") !== txn.state) {
    return failure(req, "Your sign-in attempt expired - please try again");
  }

  // Exchange the code (proving we started the flow with the PKCE verifier) for Keycloak's token.
  const tokenRes = await fetch(`${sso.issuer}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: sso.clientId,
      code,
      redirect_uri: redirectUri(req.nextUrl.origin),
      code_verifier: txn.verifier,
    }),
    cache: "no-store",
  }).catch(() => null);
  if (!tokenRes?.ok) return failure(req, "Keycloak did not accept the sign-in - please try again");
  const { access_token: keycloakToken } = (await tokenRes.json()) as { access_token?: string };
  if (!keycloakToken) return failure(req, "Keycloak did not return a token");

  // The backend verifies the token and decides whether this person may use the portal.
  const backendRes = await fetch(`${BACKEND_URL}/auth/sso`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: keycloakToken }),
    cache: "no-store",
  }).catch(() => null);
  if (!backendRes?.ok) {
    const body = await backendRes?.json().catch(() => null);
    return failure(req, body?.message ?? "The portal could not sign you in");
  }
  const { accessToken } = (await backendRes.json()) as { accessToken: string };

  const res = NextResponse.redirect(new URL(safeReturnPath(txn.from), req.url));
  res.cookies.set(AUTH_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // matches the backend JWT's 12h expiry
  });
  res.cookies.delete({ name: SSO_COOKIE, path: "/api/session/sso" });
  return res;
}
