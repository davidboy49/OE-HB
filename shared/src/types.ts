export interface Department {
  id: string;
  name: string;
  description: string | null;
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
}

export type UserRole = "ADMIN" | "OE_LEADER" | "OE_MEMBER" | "DEPT_PIC";

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
  plannedEngagementId?: string | null;
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
  day?: string;
  date: string;
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
  createdBy?: string; // Name of the user who created this plan
  createdAt?: string;
  updatedAt?: string;
}

export interface PlannedEngagement {
  id: string;
  annualPlanId: string;
  no: string;
  projectName: string;
  topic: string;
  bu: string;
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
  isUsed?: boolean; // true once an Individual OE Plan (OePlan) has been created from this engagement
  individualPlanStatus?: OePlan["status"]; // status of the (latest) Individual OE Plan created from this engagement
  annualPlanStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}
