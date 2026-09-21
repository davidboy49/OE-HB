# Keycloak sign-in

Keycloak proves **who** someone is. The OE Portal decides **what they may do** (role, group,
department, permissions and their scopes) and whether they may sign in at all.

## What the backend enforces (`POST /auth/sso`)

| Rule | Why |
| --- | --- |
| Token signature, issuer and expiry are verified against the realm's keys | Standard OIDC validation |
| If `KEYCLOAK_CLIENT_ID` is set, the token's `azp`/`aud` must match it | A token for another app in the realm is useless here |
| A returning person is found by Keycloak's permanent id (`sub`, stored as `User.keycloakSub`) | Emails change and get reused; `sub` does not |
| The **first** sign-in links an existing account by email, only if `email_verified` is true | Otherwise anyone who registers someone else's email could take over the account |
| An account already linked to a different `sub` is refused | Blocks a second identity claiming the same account |
| No account is ever created from SSO | An admin adds people first (Users page) |
| `User.isActive = false` is refused, and checked on **every request** (`JwtStrategy`) | Deactivating someone works at once, not after the 12h token expires |

Set `KEYCLOAK_REQUIRE_VERIFIED_EMAIL=false` only for a realm that never verifies emails.

## Keycloak setup

Web sign-in: create a **public** OpenID Connect client (no secret; PKCE is used) with
- Valid redirect URI: `https://<portal>/api/session/sso/callback`
- Client scopes: `openid`, `email`, `profile`

Then set on the frontend `KEYCLOAK_ISSUER` and `KEYCLOAK_WEB_CLIENT_ID`; the login page shows
"Sign in with company SSO" once both are present. On the backend set `KEYCLOAK_ISSUER` (and
preferably `KEYCLOAK_CLIENT_ID`). The mobile app keeps using `POST /auth/sso` directly.

Not done yet: signing out of Keycloak itself (logging out of the portal ends only the portal
session).
