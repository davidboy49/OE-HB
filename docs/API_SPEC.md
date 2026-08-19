# AuditDesk API

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
| Audit Projects | `/audit-projects` |
| Execution Schedules | `/execution-schedules` (`/execution-schedules/qr/:qrToken` is public) |
| Meetings | `/meetings` (`/meetings/qr/:qrToken` and its consent endpoint are public - the QR-code consent flow) |
| Findings | `/findings` |
| Attachments | `/attachments` |
| Annual Plans | `/annual-plans` |
| Audit Plans | `/audit-plans` |
| Notifications | `/notifications` (SMTP config, email templates, and the email-sending endpoints) |
| Activity Logs | `/activity-logs` (admin only) |

## Auth

All non-public routes require `Authorization: Bearer <token>`. The frontend never handles this directly - the token lives in an httpOnly cookie, and every backend call is routed through `frontend/src/app/api/backend/[...path]/route.ts`, which attaches it server-side. See the root README for the login flow.

## Authorization

Routes are restricted with `@RequirePermission('domain:action')`, enforced by a global `PermissionsGuard` (see `backend/src/common/permissions.ts` for the full capability list). `ADMIN` always bypasses. A user's granted permissions come from their `UserGroup` (`GET /user-groups/:id/permissions`); a user with no group falls back to a fixed default set per role (`DEFAULT_PERMISSIONS_BY_ROLE`), reproducing the original app's behavior for anyone not yet assigned to a group. Where a route has no `@RequirePermission()` decorator, any authenticated user can call it.
