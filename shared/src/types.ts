export interface Department {
  id: string;
  name: string;
  description: string | null;
}

export interface UserGroup {
  id: string;
  name: string;
  description: string | null;
}

export type UserRole = "ADMIN" | "LEAD_AUDITOR" | "AUDITOR" | "AUDITEE";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  departmentId: string | null;
  groupId: string | null;
  departmentName?: string | null;
  groupName?: string | null;
  /** Effective granular permission keys (see backend/src/common/permissions.ts). Only present on GET /auth/me. */
  permissions?: string[];
}

export interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileData: string; // Base64
  projectId: string;
  createdAt: string;
}

export interface AuditProject {
  id: string;
  name: string;
  code: string;
  status: "PLANNING" | "SUBMITTED_FOR_APPROVAL" | "RELEASED" | "CLOSED";
  workflowStage: "DRAFTING" | "REVIEW" | "PENDING_PIC" | "APPROVED";
  deptPicIds: string; // Comma-separated list of User IDs representing department PICs
  departments: string; // Comma-separated list of Department names
  scope: string;
  planningDetails: string;
  startDate: string;
  endDate: string;
  leadAuditorId: string | null;

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

  auditorIds?: string[]; // Array of selected auditor user IDs
  auditorNames?: string;
  attachments?: Attachment[];
  findings?: {
    id: string;
    title: string;
    description?: string;
    status: string;
    severity?: string;
    recommendation?: string;
    auditorName?: string;
    createdAt?: string;
    executionScheduleId?: string;
  }[];
  executionSchedules?: { id: string; visitNumber: string; language: string; status?: string; departments: string; ownerName?: string; lastModifiedBy?: string; attendeeConfirmations?: string; scheduleRows?: string }[];
  openMeetings?: OpenMeeting[];

  annualPlanId?: string | null;
  auditPlanId?: string | null;
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
  auditorId: string;
  auditorName?: string;
  createdAt: string;
}

export interface ScheduleRow {
  day?: string;
  date: string;
  time: string;
  auditScope?: string;
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
  auditPeriod: string;
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
  attachments?: string; // JSON
  ownerName?: string;
  lastModifiedBy?: string;
  qrToken?: string;
  departmentConsents?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OpenMeeting {
  id: string;
  projectId: string;
  projectName?: string;
  projectCode?: string;
  departments: string;
  address: string;
  visitNumber: string;
  actualVisitDate: string;
  auditPeriod: string;
  leadExecution: string;
  teamMembers: string;
  additionalAttendees: string;
  attendeeConfirmations?: string;
  standards: string;
  status: "DRAFT" | "RELEASED";
  objectives: string;
  scope: string;
  scheduleRows: string; // JSON
  attachments?: string; // JSON
  ownerName?: string;
  lastModifiedBy?: string;
  qrToken?: string;
  departmentConsents?: string;
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
  createdAt?: string;
  updatedAt?: string;
}

export interface AuditPlan {
  id: string;
  annualPlanId: string;
  no: string;
  topic: string;
  type?: string;
  revieweeIds: string; // Comma-separated User IDs
  conductDate: string; // ISO date string
  endDate: string; // ISO date string
  durationDay: number;
  purpose: string;
  version?: string;
  nextVersion?: string;
  isProcessed?: boolean;
  isApproved?: boolean;
  annualPlanStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}
