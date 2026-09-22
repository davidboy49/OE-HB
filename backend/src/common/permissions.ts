import type { UserRole } from '@oeportal/shared';

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
  // View access - who may READ each module. Denied by default: a group (or role default)
  // that does not hold the key gets a 403 from the API and never sees the menu item.
  // Record-bearing modules can additionally be limited by a scope (see ACCESS_SCOPES).
  { key: 'annual-plans:view', description: 'View Annual OE Plans' },
  { key: 'projects:view', description: 'View Projects' },
  { key: 'oe-plans:view', description: 'View Individual OE Plans' },
  { key: 'meetings:view', description: 'View Open Meetings' },
  { key: 'execution-schedules:view', description: 'View Execution Schedules' },
  { key: 'findings:view', description: 'View OE Findings and Findings Alerts' },
  { key: 'departments:view', description: 'View departments' },
  { key: 'business-units:view', description: 'View business units' },
  { key: 'users:view', description: 'View the user list' },
  {
    key: 'user-groups:view',
    description: 'View user groups, the permission catalog and API policies',
  },

  // Departments
  { key: 'departments:create', description: 'Create departments' },
  { key: 'departments:update', description: 'Edit departments' },
  { key: 'departments:delete', description: 'Delete departments' },

  // Business Units
  { key: 'business-units:create', description: 'Create business units' },
  { key: 'business-units:update', description: 'Edit business units' },
  { key: 'business-units:delete', description: 'Delete business units' },

  // Users
  { key: 'users:create', description: 'Create users' },
  { key: 'users:update', description: 'Edit user profiles/roles' },
  { key: 'users:delete', description: 'Delete users' },
  { key: 'users:set-password', description: "Set another user's password" },

  // User Groups
  { key: 'user-groups:create', description: 'Create and copy user groups' },
  { key: 'user-groups:update', description: 'Edit user groups' },
  { key: 'user-groups:delete', description: 'Delete user groups' },
  {
    key: 'user-groups:manage-permissions',
    description: 'Grant/revoke permissions on a group',
  },

  // OE Plans
  { key: 'oe-plans:create', description: 'Create Individual OE Plans' },
  { key: 'oe-plans:update', description: 'Edit Individual OE Plans' },
  { key: 'oe-plans:delete', description: 'Delete Individual OE Plans' },
  {
    key: 'oe-plans:submit',
    description: 'Submit an Individual OE Plan for approval',
  },
  {
    key: 'oe-plans:approve',
    description: 'Approve, reject, or reopen a submitted Individual OE Plan',
  },
  {
    key: 'oe-plans:close',
    description: 'Close a released Individual OE Plan',
  },
  {
    key: 'oe-plans:reopen',
    description: 'Reopen a closed Individual OE Plan',
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
  {
    key: 'meetings:submit',
    description: 'Submit an open meeting report for approval',
  },
  {
    key: 'meetings:approve',
    description: 'Approve, reject, or reopen a submitted open meeting report',
  },

  // Findings
  { key: 'findings:create', description: 'Log OE findings' },
  { key: 'findings:update', description: 'Edit OE findings' },

  // Meeting responses (department users answer released Open Meetings)
  {
    key: 'meeting-responses:create',
    description: "Respond to your own department's Open Meetings",
  },
  {
    key: 'meeting-responses:view-all',
    description: 'See every Open Meeting and all department responses',
  },

  // Annual Plans
  { key: 'annual-plans:create', description: 'Create annual plans' },
  { key: 'annual-plans:update', description: 'Edit annual plans' },
  { key: 'annual-plans:delete', description: 'Delete annual plans' },
  {
    key: 'annual-plans:submit',
    description: 'Submit an annual plan for approval',
  },
  {
    key: 'annual-plans:approve',
    description: 'Approve or reject a submitted annual plan',
  },

  // OE Plans
  { key: 'projects:create', description: 'Create Projects' },
  { key: 'projects:update', description: 'Edit Projects' },
  { key: 'projects:delete', description: 'Delete Projects' },

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
  OE_LEADER: PERMISSION_KEYS.filter((k) => k !== 'notifications:configure'),
  OE_MEMBER: [
    'annual-plans:view',
    'projects:view',
    'oe-plans:view',
    'meetings:view',
    'execution-schedules:view',
    'findings:view',
    'departments:view',
    'business-units:view',
    'users:view',
    'oe-plans:create',
    'oe-plans:update',
    'oe-plans:submit',
    'execution-schedules:create',
    'execution-schedules:update',
    'meetings:create',
    'meetings:update',
    'meetings:submit',
    'meeting-responses:create',
    'findings:create',
    'findings:update',
    'annual-plans:create',
    'annual-plans:update',
    'annual-plans:submit',
    'projects:create',
    'projects:update',
    'notifications:send-test',
    'notifications:send',
  ],
  DEPT_PIC: ['meeting-responses:create', 'notifications:send'],
};

// ---------------------------------------------------------------------------------------------
// Catalog metadata (what the admin "permissions" screen and the API policies page show)
// ---------------------------------------------------------------------------------------------

/**
 * How far a grant reaches. Only "view" of record-bearing modules is scoped; writing to a
 * record additionally requires that record to be inside the caller's view scope.
 *   ALL         every record
 *   BU          records belonging to the caller's own Business Unit
 *   DEPARTMENT  records belonging to the caller's own department
 *   MEMBER      OE Plans (and what hangs off them) where the caller is the leader or a member
 */
export const ACCESS_SCOPES = ['ALL', 'BU', 'DEPARTMENT', 'MEMBER'] as const;
export type AccessScope = (typeof ACCESS_SCOPES)[number];

export type RiskTag = 'HIGH_PRIVILEGE' | 'CHANGES_DATA';

const SCOPED_MODULES_WITH_MEMBER = [
  'oe-plans',
  'meetings',
  'execution-schedules',
  'findings',
];
const SCOPED_MODULES_NO_MEMBER = ['annual-plans', 'projects'];

export const moduleOf = (key: string) => key.split(':')[0];
export const actionOf = (key: string) => key.split(':').slice(1).join(':');

/** Scopes an admin may choose for this permission. Everything else is always ALL. */
export function scopesFor(key: string): AccessScope[] {
  if (actionOf(key) !== 'view') return ['ALL'];
  const m = moduleOf(key);
  if (SCOPED_MODULES_WITH_MEMBER.includes(m)) return [...ACCESS_SCOPES];
  if (SCOPED_MODULES_NO_MEMBER.includes(m)) return ['ALL', 'BU', 'DEPARTMENT'];
  return ['ALL'];
}

export const isScopable = (key: string) => scopesFor(key).length > 1;

export const MODULE_LABELS: Record<string, string> = {
  'annual-plans': 'Annual OE Plans',
  projects: 'Projects',
  'oe-plans': 'Individual OE Plans',
  meetings: 'Open Meetings',
  'meeting-responses': 'Department Responses',
  'execution-schedules': 'Execution Schedules',
  findings: 'OE Findings',
  departments: 'Departments',
  'business-units': 'Business Units',
  users: 'Users',
  'user-groups': 'User Groups & Permissions',
  notifications: 'Notifications',
  'activity-logs': 'Activity Logs',
};

const HIGH_PRIVILEGE_ACTIONS = [
  'approve',
  'close',
  'reopen',
  'delete',
  'manage-permissions',
  'configure',
  'view-all',
  'set-password',
];

export function risksOf(key: string): RiskTag[] {
  const action = actionOf(key);
  const risks: RiskTag[] = [];
  if (HIGH_PRIVILEGE_ACTIONS.includes(action)) risks.push('HIGH_PRIVILEGE');
  if (action !== 'view' && action !== 'view-all') risks.push('CHANGES_DATA');
  return risks;
}

export interface PermissionCatalogEntry {
  key: string;
  title: string;
  module: string;
  moduleLabel: string;
  action: string;
  risks: RiskTag[];
  /** More than one entry means the admin can choose how far the grant reaches. */
  scopes: AccessScope[];
}

export const PERMISSION_CATALOG: PermissionCatalogEntry[] = PERMISSIONS.map(
  (p) => ({
    key: p.key,
    title: p.description,
    module: moduleOf(p.key),
    moduleLabel: MODULE_LABELS[moduleOf(p.key)] ?? moduleOf(p.key),
    action: actionOf(p.key),
    risks: risksOf(p.key),
    scopes: scopesFor(p.key),
  }),
);
