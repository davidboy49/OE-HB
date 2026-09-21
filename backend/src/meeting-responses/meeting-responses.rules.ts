/**
 * Pure rules for Open Meeting responses - kept free of Nest/Prisma so they can be unit-tested
 * and changed in one place.
 */

export const RESPONSE_STATUSES = ['ACCEPTED', 'REVISION_REQUESTED'] as const;
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];

export type ClosedReason =
  | 'MEETING_NOT_RELEASED'
  | 'PLAN_NOT_RELEASED'
  | 'ANNUAL_PLAN_NOT_APPROVED'
  | 'MEETING_DATE_PASSED';

export interface ResponseWindow {
  open: boolean;
  reason?: ClosedReason;
}

export interface ResponseWindowInput {
  meetingStatus: string;
  /** 'YYYY-MM-DD' (the meeting form's date input). Empty/invalid means no deadline. */
  meetingDate: string;
  planStatus: string;
  annualPlanStatus?: string | null;
  /** Today as 'YYYY-MM-DD' in the company's time zone (see todayInTimeZone). */
  today: string;
}

/**
 * Responses stay open while the meeting is RELEASED (approved by an OE Leader), its OE Plan
 * is RELEASED (not Closed), the Annual Plan is APPROVED and the meeting date has not passed.
 * Once any of those stops being true the meeting is read-only and the department's
 * responses are final.
 */
export function getResponseWindow(i: ResponseWindowInput): ResponseWindow {
  if (i.meetingStatus !== 'RELEASED')
    return { open: false, reason: 'MEETING_NOT_RELEASED' };
  if (i.planStatus !== 'RELEASED')
    return { open: false, reason: 'PLAN_NOT_RELEASED' };
  if (i.annualPlanStatus != null && i.annualPlanStatus !== 'APPROVED')
    return { open: false, reason: 'ANNUAL_PLAN_NOT_APPROVED' };
  if (/^\d{4}-\d{2}-\d{2}$/.test(i.meetingDate) && i.today > i.meetingDate)
    return { open: false, reason: 'MEETING_DATE_PASSED' };
  return { open: true };
}

/** Today's date ('YYYY-MM-DD') in the given IANA time zone. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export type DepartmentProgress =
  | 'AWAITING' // still open, nobody from the department has responded yet
  | 'RESPONDED' // still open, at least one response in (more can be added)
  | 'DONE' // read-only and at least one response was recorded
  | 'MISSED'; // read-only and nobody from the department ever responded

/** "At least one user from the department responded, and the meeting is now read-only" = done. */
export function departmentProgress(
  window: ResponseWindow,
  responseCount: number,
): DepartmentProgress {
  if (window.open) return responseCount > 0 ? 'RESPONDED' : 'AWAITING';
  return responseCount > 0 ? 'DONE' : 'MISSED';
}

/** True when the HTML has no visible text (e.g. an empty editor's "<p></p>"). */
export function isBlankHtml(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim().length === 0
  );
}
