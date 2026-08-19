# 🔍 AuditDesk - Modern Audit Management System

AuditDesk is a comprehensive Audit Management web application. It streamlines the entire internal and external audit lifecycle from initial planning to execution tracking, findings management, meeting records, and reporting.

This repo is a fresh rework of the original [AuditDesk](https://github.com/davidboy49/AuditDesk) Next.js monolith, split into an independent **frontend** and **backend** in one monorepo.

---

## ✨ Features

- **📋 Audit Planning & Scoping**: Define audit projects, scope, risk analysis, timeline, and lead auditor assignments.
- **📅 Execution Schedules**: Organize site visits, daily audit activities, attendees, and schedule sign-offs.
- **⚠️ Findings & CAR/PAR Tracking**: Record audit findings with severity ratings (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), recommendations, and corrective action plans.
- **🤝 Meetings & Minutes**: Document opening and closing meeting discussions with TipTap rich text editing and attendance confirmations.
- **🏢 Departments & User Management**: Role-Based Access Control (RBAC) supporting `ADMIN`, `LEAD_AUDITOR`, `AUDITOR`, and `AUDITEE`, plus per-`UserGroup` granular permissions (create/update/delete, per domain) that an admin can tick on and off.
- **📜 Audit Trail & Activity Logs**: Record all system actions for compliance and history tracking.
- **📑 OpenAPI & Swagger Documentation**: REST API with interactive Swagger UI served by the backend.

---

## 🏗️ Architecture

```
.
├── frontend/     # Next.js 16 (App Router), React 19, Tailwind CSS v4 - UI only
├── backend/      # NestJS REST API - auth, business logic, Prisma/Postgres data access
├── shared/       # Shared TypeScript types & pure utility functions used by both
├── docker-compose.yml   # Local Postgres for development
└── docs/         # API & project documentation
```

- **Frontend** talks to the backend exclusively over HTTP (REST); it holds no direct database access and no server-side business logic.
- **Backend** owns all data access (Prisma ORM + PostgreSQL), RBAC, activity logging, and email notifications, and publishes its API via Swagger.
- **Auth** is email+password (bcrypt) via a Passport `LocalStrategy`, then JWT for every subsequent request - structured to be swapped for Keycloak/OIDC once that PRD exists (only the login strategy changes; `JwtStrategy`/guards/`@CurrentUser()` stay the same).
- **Authorization** is per-`UserGroup` granular permissions (`PermissionsGuard` + `@RequirePermission()`), not fixed roles - `ADMIN` always bypasses; a user with no group falls back to a fixed default-by-role permission set. Manage grants on the Users page ("Manage Permissions" per group) or via `PATCH /user-groups/:id/permissions`.
- **Shared** holds the TypeScript domain types and the pure formatting/parsing helpers (`findingsAlertUtils`, `planItemUtils`) so both sides stay in sync without duplicating logic.

---

## 🛠️ Tech Stack

| | |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons, TipTap Editor |
| **Backend** | NestJS 11, Passport/JWT, Prisma ORM |
| **Database** | PostgreSQL |
| **API & Docs** | OpenAPI 3.0 via `@nestjs/swagger` |
| **Utilities** | Nodemailer, QRCode |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- A PostgreSQL database - either local via Docker, or any remote/managed instance

### 1. Install dependencies (all workspaces)

```bash
npm install
```

### 2. Environment variables

Copy the example env files and adjust as needed:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Set `DATABASE_URL` in `backend/.env` to your Postgres instance, and `SEED_ADMIN_PASSWORD` to whatever you want the seeded admin's login password to be - the seed script sets a password **only** on that one account; every other seeded user starts with no password and needs one set by the admin afterward (Users page → select a user → "Set Password for Selected User").

### 3. Start Postgres (skip if using a remote/managed instance)

```bash
docker compose up -d
```

### 4. Set up the database

```bash
cd backend
npx prisma migrate dev   # if your DB user can CREATE DATABASE (needed for the shadow DB)
# — or, if it can't (common on managed/restricted-permission hosts) —
npx prisma db push       # syncs the schema directly, no shadow DB required

npx prisma db seed
cd ..
```

### 5. Build the shared package

```bash
npm run build:shared
```

### 6. Run both apps

```bash
npm run dev
```

This runs the backend (`http://localhost:3001`) and frontend (`http://localhost:3000`) together. To run them separately: `npm run dev:backend` / `npm run dev:frontend`.

> Windows note: `nest start --watch` can hit a harmless `tree-kill` race after a fast successive restart. If that happens, `Ctrl+C` and run `npm run build && node dist/src/main.js` in `backend/` instead.

---

## 📚 API & Documentation

- **Interactive Swagger UI**: [`http://localhost:3001/api-docs`](http://localhost:3001/api-docs)
- **API Specification Guide**: See [`docs/API_SPEC.md`](./docs/API_SPEC.md)

---

## 📄 License

Private & Proprietary - AuditDesk Project.
