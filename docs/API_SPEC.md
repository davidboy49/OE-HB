# OE Portal API

The backend (NestJS) is the single source of truth for the REST API. Every controller carries `@nestjs/swagger` decorators, so the docs below are generated from the actual route/DTO definitions and can't drift out of sync the way a hand-written spec would.

- **Interactive Swagger UI**: `http://localhost:3001/api-docs`
- **Raw OpenAPI 3.0 JSON**: `http://localhost:3001/api-docs-json`

## Domains

| Domain | Base path |
|---|---|
| Auth | `/auth` (`/auth/login` is public - `POST { email, password }`; everything else requires a bearer token) |
| Departments | `/departments` |
| Users | `/users` (includes `PATCH /users/:id/password`, admin-only) |
| User Groups | `/user-groups` (includes `GET/PATCH /user-groups/:id/permissions`) |
| Permissions | `/permissions` (lists every capability key + description, for rendering a permission matrix) |
| OE Plans | `/oe-plans` |
| Execution Schedules | `/execution-schedules` (`/execution-schedules/qr/:qrToken` is public) |
| Meetings | `/meetings` (`/meetings/qr/:qrToken` and its consent endpoint are public - the QR-code consent flow) |
| Findings | `/findings` |
| Annual Plans | `/annual-plans` |
| Projects | `/projects` (`/planned-engagements` is kept as an alias for existing clients) |
| Notifications | `/notifications` (SMTP config, email templates, and the email-sending endpoints) |
| Activity Logs | `/activity-logs` (admin only) |

## Auth

All non-public routes require `Authorization: Bearer <token>`. The frontend never handles this directly - the token lives in an httpOnly cookie, and every backend call is routed through `frontend/src/app/api/backend/[...path]/route.ts`, which attaches it server-side. See the root README for the login flow.

## Authorization

Access is **denied by default**. Every route must declare its rule - `@Public()`, `@RequirePermission('module:action')`, `@DynamicPermission(...)` (the handler picks which permission applies) or `@Authenticated()` (any signed-in user, data scoped to the caller) - and a route with none is refused. The global `PermissionsGuard` enforces it, and `route-inventory.spec.ts` fails the build if a route is undeclared or a record read lacks its `:view` permission. The full list is also shown, read-only, on the Access Control page (`GET /permissions/routes`).

A user's grants come from their `UserGroup` (`GET /user-groups/:id/permissions`, each `{ key, scope }`); a user with no group falls back to `DEFAULT_PERMISSIONS_BY_ROLE`; `ADMIN` holds everything at scope `ALL`. Reading a record module needs its `:view` permission, whose **scope** (`ALL` / `BU` / `DEPARTMENT` / `MEMBER`) limits which records come back; writing needs the write permission AND the record inside that view scope (404 otherwise). Grants are re-read from the database on every request, and a deactivated user (`PATCH /users/:id/active`) is refused on the next one.

Keycloak (see `KEYCLOAK.md`) only authenticates; roles, groups and scopes always live here.
