import type { UserRole } from '@auditdesk/shared';

/**
 * Single source of truth for the granular permission system: every capability
 * key used by @RequirePermission(), seeded into the Permission table, and
 * rendered in the frontend's per-group permission matrix.
 *
 * ADMIN always bypasses these checks (see PermissionsGuard) - this list only
 * matters for non-ADMIN users. A user's effective permissions come from their
 * UserGroup's grants; a user with no group falls back to DEFAULT_PERMISSIONS_BY_ROLE
 * below, which reproduces the pre-permissions-system behavior 1:1.
 */
export interface PermissionDef {
  key: string;
  description: string;
}

export const PERMISSIONS: PermissionDef[] = [
  // Departments
  { key: 'departments:create', description: 'Create departments' },
  { key: 'departments:update', description: 'Edit departments' },
  { key: 'departments:delete', description: 'Delete departments' },

  // Users
  { key: 'users:create', description: 'Create users' },
  { key: 'users:update', description: 'Edit user profiles/roles' },
  { key: 'users:delete', description: 'Delete users' },
  { key: 'users:set-password', description: "Set another user's password" },

  // User Groups
  { key: 'user-groups:create', description: 'Create user groups' },
  {
    key: 'user-groups:manage-permissions',
    description: 'Grant/revoke permissions on a group',
  },

  // Audit Projects
  { key: 'audit-projects:create', description: 'Create audit projects' },
  { key: 'audit-projects:update', description: 'Edit audit projects' },
  { key: 'audit-projects:delete', description: 'Delete audit projects' },
  {
    key: 'audit-projects:submit',
    description: 'Submit an individual audit plan for approval',
  },
  {
    key: 'audit-projects:approve',
    description: 'Approve, reject, or reopen a submitted individual audit plan',
  },
  {
    key: 'audit-projects:close',
    description: 'Close a released individual audit plan',
  },
  {
    key: 'audit-projects:reopen',
    description: 'Reopen a closed individual audit plan',
  },

  // Execution Schedules
  {
    key: 'execution-schedules:create',
    description: 'Create execution schedules',
  },
  {
    key: 'execution-schedules:update',
    description: 'Edit execution schedules',
  },
  {
    key: 'execution-schedules:delete',
    description: 'Delete execution schedules',
  },

  // Meetings
  { key: 'meetings:create', description: 'Create open meetings' },
  { key: 'meetings:update', description: 'Edit open meetings' },
  { key: 'meetings:delete', description: 'Delete open meetings' },

  // Findings
  { key: 'findings:create', description: 'Log audit findings' },
  { key: 'findings:update', description: 'Edit audit findings' },

  // Attachments
  { key: 'attachments:create', description: 'Upload attachments' },
  { key: 'attachments:delete', description: 'Delete attachments' },

  // Annual Plans
  { key: 'annual-plans:create', description: 'Create annual plans' },
  { key: 'annual-plans:update', description: 'Edit annual plans' },
  { key: 'annual-plans:delete', description: 'Delete annual plans' },
  { key: 'annual-plans:submit', description: 'Submit an annual plan for approval' },
  {
    key: 'annual-plans:approve',
    description: 'Approve or reject a submitted annual plan',
  },

  // Audit Plans
  { key: 'audit-plans:create', description: 'Create audit plans' },
  { key: 'audit-plans:update', description: 'Edit audit plans' },
  { key: 'audit-plans:delete', description: 'Delete audit plans' },

  // Notifications
  {
    key: 'notifications:configure',
    description: 'Edit SMTP config & email templates',
  },
  { key: 'notifications:send-test', description: 'Send a test email' },
  {
    key: 'notifications:send',
    description: 'Trigger meeting-release/finding/notification emails',
  },

  // Activity Logs
  { key: 'activity-logs:view', description: 'View the activity log' },
  {
    key: 'activity-logs:create',
    description: 'Add a manual activity log entry',
  },
  { key: 'activity-logs:delete', description: 'Delete an activity log entry' },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

/**
 * Fallback for users with no UserGroup (permissions live on the group, not the
 * user). Reproduces what each role could already do before this system existed,
 * so ungrouped users see zero regression.
 */
export const DEFAULT_PERMISSIONS_BY_ROLE: Record<UserRole, string[]> = {
  ADMIN: PERMISSION_KEYS, // unused in practice - ADMIN bypasses the guard entirely
  LEAD_AUDITOR: PERMISSION_KEYS.filter((k) => k !== 'notifications:configure'),
  AUDITOR: [
    'audit-projects:create',
    'audit-projects:update',
    'audit-projects:submit',
    'execution-schedules:create',
    'execution-schedules:update',
    'meetings:create',
    'meetings:update',
    'findings:create',
    'findings:update',
    'attachments:create',
    'attachments:delete',
    'annual-plans:create',
    'annual-plans:update',
    'annual-plans:submit',
    'audit-plans:create',
    'audit-plans:update',
    'notifications:send-test',
    'notifications:send',
  ],
  AUDITEE: ['attachments:create', 'notifications:send'],
};
