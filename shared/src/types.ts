export interface Department {
  id: string;
  name: string;
  description: string | null;
  businessUnitId?: string | null; // Each Business Unit has its own departments
  businessUnitName?: string | null;
}

export interface BusinessUnit {
  id: string;
  name: string;
  description: string | null;
}

export interface UserGroup {
  id: string;
  name: string;
  description: string | null;
  /** Keycloak group name (e.g. "/finance") that syncs members into this role on SSO sign-in; null = not synced. */
  keycloakGroup: string | null;
  /** Only present on GET /user-groups. */
  memberCount?: number;
  permissionCount?: number;
}

/** How far a permission grant reaches (see backend/src/common/permissions.ts). */
export type AccessScope = "ALL" | "BU" | "DEPARTMENT" | "MEMBER";
export type PermissionRisk = "HIGH_PRIVILEGE" | "CHANGES_DATA";

/** One permission as listed on the Access Control screen (GET /permissions). */
export interface PermissionCatalogEntry {
  key: string;
  title: string;
  module: string;
  moduleLabel: string;
  action: string;
  risks: PermissionRisk[];
  /** More than one entry means an admin can choose how far the grant reaches. */
  scopes: AccessScope[];
}

/** A permission granted to a group, with its scope (GET/PATCH /user-groups/:id/permissions). */
export interface GroupGrant {
  key: string;
  scope: AccessScope;
}

/** One API route and what protects it (GET /permissions/routes). */
export interface ApiRoutePolicy {
  method: string;
  path: string;
  access: "PUBLIC" | "AUTHENTICATED" | "PERMISSION" | "UNDECLARED";
  /** Permissions that unlock the route (several = the handler picks one, see `dynamic`). */
  permissions: string[];
  dynamic: boolean;
  title: string | null;
  module: string | null;
  risks: PermissionRisk[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  departmentId: string | null;
  groupId: string | null;
  departmentName?: string | null;
  groupName?: string | null;
  /** false = deactivated: cannot sign in and existing sessions stop working. Only present on GET /users. */
  isActive?: boolean;
  /** true once this account has signed in through Keycloak SSO. Only present on GET /users. */
  ssoLinked?: boolean;
  /** Effective granular permission keys (see backend/src/common/permissions.ts). Present on GET /auth/me and GET /users. */
  permissions?: string[];
  /** Same keys, each with how far it reaches (ALL / BU / DEPARTMENT / MEMBER). Only present on GET /auth/me. */
  grants?: Record<string, AccessScope>;
}

export interface OePlan {
  id: string;
  name: string;
  code: string;
  status: "PLANNING" | "SUBMITTED_FOR_APPROVAL" | "RELEASED" | "CLOSED";
  workflowStage: "DRAFTING" | "REVIEW" | "PENDING_PIC" | "APPROVED";
  createdBy?: string; // Name of the user who created this plan
  deptPicIds: string; // Comma-separated list of User IDs representing department PICs
  departments: string; // Comma-separated list of Department names
  scope: string;
  planningDetails: string;
  startDate: string;
  endDate: string;
  leaderId: string | null;

  // Custom Scoping details fields
  objectives: string;
  riskProcess: string;
  riskClass: string;
  opEx: string;
  fieldwork: string;
  outcome: string;
  dataRequestType: string;
  focusArea: string;
  opExTimeline: string;
  approvals: string;
  deptPicConfirmations?: string;

  memberIds?: string[]; // Array of selected member user IDs
  memberNames?: string;
  /** Who closed this plan and when - server-stamped on the RELEASED->CLOSED transition, empty
   * string when not currently closed (or after a reopen). Never client-supplied. */
  closedByName?: string;
  closedDate?: string;
  findings?: {
    id: string;
    title: string;
    description?: string;
    status: string;
    severity?: string;
    recommendation?: string;
    memberName?: string;
    createdAt?: string;
    executionScheduleId?: string;
  }[];
  executionSchedules?: { id: string; visitNumber: string; language: string; status?: string; departments: string; ownerName?: string; lastModifiedBy?: string; attendeeConfirmations?: string; scheduleRows?: string }[];
  openMeetings?: OpenMeeting[];

  annualPlanId?: string | null;
  projectId?: string | null;
}

export interface Finding {
  id: string;
  title: string;
  description: string;
  status: "OPEN" | "UNDER_REVIEW" | "CLOSED";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendation: string;
  executionScheduleId: string;
  projectId?: string;
  projectName?: string;
  memberId: string;
  memberName?: string;
  createdAt: string;
}

export interface ScheduleRow {
  /** Stable per-row id, used to target a single row without touching the rest of the array
   * (see ResolveFindingRowDto). Optional only for backward compatibility with rows saved
   * before this field existed - any normal save backfills it. */
  id?: string;
  day?: string;
  date: string;
  /** End of the execution date range. Empty/equal to `date` means a single-day slot. */
  dateTo?: string;
  time: string;
  oeScope?: string;
  activity: string;
  conductBy: string;
  pIncharge: string;
  dataRequest?: string;
  implication?: string;
  recommendation?: string;
  correctiveActionDate?: string;
  correctiveActionRemarks?: string;
  correctiveFinalDate?: string;
  correctiveFinalRemarks?: string;
  correctiveFinalUser?: string;
  correctiveFinalDatetime?: string;
}

export interface ExecutionSchedule {
  id: string;
  projectId: string;
  projectName?: string;
  projectCode?: string;
  departments: string;
  address: string;
  visitNumber: string;
  actualVisitDate: string;
  oePeriod: string;
  leadExecution: string;
  teamMembers: string;
  additionalAttendees: string;
  attendeeConfirmations?: string;
  standards: string;
  language: string;
  status: "DRAFT" | "RELEASED";
  objectives: string;
  scope: string;
  scheduleRows: string; // JSON
  ownerName?: string;
  lastModifiedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OpenMeeting {
  id: string;
  projectId: string;
  projectName?: string;
  projectCode?: string;
  departmentId?: string | null;
  departments: string;
  address: string;
  visitNumber: string;
  actualVisitDate: string;
  oePeriod: string;
  leadExecution: string;
  teamMembers: string;
  additionalAttendees: string;
  attendeeConfirmations?: string;
  standards: string;
  status: "DRAFT" | "SUBMITTED_FOR_APPROVAL" | "RELEASED";
  objectives: string;
  scope: string;
  scheduleRows: string; // JSON
  ownerName?: string;
  lastModifiedBy?: string;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AnnualPlan {
  id: string;
  planName: string;
  period: string;
  comment: string;
  status: string; // "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED"
  createdBy?: string; // Name of the user who created this plan
  qrToken?: string; // Unguessable, rotatable token the plan's QR code encodes
  createdAt?: string;
  updatedAt?: string;
}

export interface Project {
  id: string;
  annualPlanId: string;
  no: string;
  projectName: string;
  departmentId?: string | null; // The single department this project is for
  topic: string; // Department name (kept in sync with departmentId)
  bu: string; // Business Unit name (kept in sync with the department)
  type?: string;
  revieweeIds: string; // Comma-separated User IDs
  conductDate: string; // ISO date string
  endDate: string; // ISO date string
  durationDay: number;
  purpose: string;
  objectives: string;
  scope: string;
  version?: string;
  nextVersion?: string;
  isProcessed?: boolean;
  isApproved?: boolean;
  isUsed?: boolean; // true once an Individual OE Plan (OePlan) has been created from this Project
  individualPlanStatus?: OePlan["status"]; // status of the (latest) Individual OE Plan created from this Project
  /** Who closed the (latest) Individual OE Plan, and when - only meaningful when
   * individualPlanStatus is "CLOSED". See OePlan.closedByName/closedDate. */
  closedByName?: string;
  closedDate?: string;
  /** The (latest) Individual OE Plan's most recent OE Findings Report (an ExecutionSchedule
   * with language "finding"). Present only once such a report exists; findingsCompletedCount/
   * findingsTotalCount are only populated once that report's own status is "RELEASED" - use
   * them to derive a Pending ("RELEASED" but not yet completed===total) / Completed
   * (completed===total, total>0) display state on top of individualPlanStatus. */
  findingsReportStatus?: string;
  findingsCompletedCount?: number;
  findingsTotalCount?: number;
  annualPlanStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ---- Open Meeting responses (department users answer released meetings) ----

export type MeetingResponseStatus = "ACCEPTED" | "REVISION_REQUESTED";

/** AWAITING/RESPONDED = still open; DONE/MISSED = read-only (with / without any response). */
export type DepartmentProgress = "AWAITING" | "RESPONDED" | "DONE" | "MISSED";

export interface MeetingResponseItem {
  id: string;
  respondentName: string;
  respondentEmail: string;
  departmentName: string;
  businessUnitName: string;
  status: MeetingResponseStatus;
  concern: string; // sanitised HTML
  createdAt: string;
  updatedAt: string;
  mine: boolean;
}

export interface MeetingResponseCard {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  departmentId: string | null;
  departmentName: string;
  businessUnitName: string;
  meetingDate: string;
  address: string;
  annualPlanId?: string | null;
  window: { open: boolean; reason?: string; message?: string };
  progress: DepartmentProgress;
  responseCount: number;
  revisionCount: number;
  myResponse: MeetingResponseItem | null;
}

export interface MeetingResponseDetail extends MeetingResponseCard {
  standards: string;
  leadExecution: string;
  teamMembers: string;
  objectives: string;
  scope: string;
  scheduleRows: string; // JSON
  memberCount: number;
  responses: MeetingResponseItem[];
  canRespond: boolean;
}

export interface ScanPayload {
  annualPlan: { id: string; planName: string; period: string };
  viewer: {
    id: string;
    name: string;
    email: string;
    departmentId: string | null;
    departmentName: string | null;
    businessUnitName: string | null;
    canViewAll: boolean;
  };
  noDepartment: boolean;
  meetings: MeetingResponseCard[];
}

export interface RollupRow extends MeetingResponseCard {
  memberCount: number;
  responses: MeetingResponseItem[];
}

export interface RollupPayload {
  summary: {
    total: number;
    done: number;
    missed: number;
    open: number;
    withRevisionRequests: number;
  };
  meetings: RollupRow[];
}
