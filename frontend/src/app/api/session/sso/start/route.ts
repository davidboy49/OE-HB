import { NextRequest, NextResponse } from "next/server";
import { safeReturnPath } from "@/lib/return-path";
import {
  SSO_COOKIE,
  SSO_COOKIE_MAX_AGE,
  createPkce,
  getSsoConfig,
  randomState,
  redirectUri,
  type SsoTransaction,
} from "@/lib/sso";

/** Step 1: send the browser to Keycloak's sign-in page. */
export async function GET(req: NextRequest) {
  const sso = getSsoConfig();
  if (!sso) {
    return NextResponse.redirect(new URL("/login?ssoError=SSO is not configured", req.url));
  }

  const { verifier, challenge } = createPkce();
  const state = randomState();
  const txn: SsoTransaction = {
    state,
    verifier,
    from: safeReturnPath(req.nextUrl.searchParams.get("from")),
  };

  const authUrl = new URL(`${sso.issuer}/protocol/openid-connect/auth`);
  authUrl.search = new URLSearchParams({
    client_id: sso.clientId,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: redirectUri(req.nextUrl.origin),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();

  const res = NextResponse.redirect(authUrl);
  res.cookies.set(SSO_COOKIE, JSON.stringify(txn), {
    httpOnly: true,
    sameSite: "lax", // must survive the redirect back from Keycloak
    secure: process.env.NODE_ENV === "production",
    path: "/api/session/sso",
    maxAge: SSO_COOKIE_MAX_AGE,
  });
  return res;
}
