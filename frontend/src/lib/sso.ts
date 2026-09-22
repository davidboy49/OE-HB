import { createHash, randomBytes } from "node:crypto";

/**
 * Browser sign-in through the company Keycloak (OpenID Connect, Authorization Code flow with
 * PKCE). Keycloak only proves who the person is; the OE Portal backend then decides whether
 * that person has an account and what they may do (see POST /auth/sso).
 *
 * Needs a PUBLIC client in the realm (no secret - PKCE protects the exchange) whose valid
 * redirect URI is <this site>/api/session/sso/callback, with the "email" scope.
 *
 *   KEYCLOAK_ISSUER          realm base, e.g. https://sso.example.com/realms/company
 *   KEYCLOAK_WEB_CLIENT_ID   the public client's id
 *   APP_URL                  (optional) this site's public address if it differs from the
 *                            address the request arrives on (behind a proxy)
 */
export interface SsoConfig {
  issuer: string;
  clientId: string;
}

export function getSsoConfig(): SsoConfig | null {
  const issuer = process.env.KEYCLOAK_ISSUER?.replace(/\/+$/, "");
  const clientId = process.env.KEYCLOAK_WEB_CLIENT_ID;
  return issuer && clientId ? { issuer, clientId } : null;
}

const b64url = (buf: Buffer) => buf.toString("base64url");

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export function createPkce(): PkcePair {
  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export const randomState = () => b64url(randomBytes(24));

/** The one-time login attempt, kept in a short-lived httpOnly cookie between redirect and callback. */
export const SSO_COOKIE = "sso_txn";
export const SSO_COOKIE_MAX_AGE = 10 * 60;

export interface SsoTransaction {
  state: string;
  verifier: string;
  from: string;
}

export function redirectUri(origin: string): string {
  const base = (process.env.APP_URL ?? origin).replace(/\/+$/, "");
  return `${base}/api/session/sso/callback`;
}
