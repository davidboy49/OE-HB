/**
 * Cross-cutting business-rule validation shared between the backend (enforced, authoritative)
 * and the frontend (pre-checked, so a person sees the problem before submitting instead of
 * after a round trip). Keeping a rule here instead of writing it twice means the two can never
 * silently drift apart - if the rule changes, both sides change together.
 */
import { hasPlanItemContent } from "./planItemUtils";

export const SCOPE_REQUIRED_MESSAGE =
  "Scope is required: add at least one scope item before saving.";

/** Throws-free scope check for a form to call before submit; the backend re-checks regardless. */
export function validateScope(raw: string | undefined): string | null {
  return hasPlanItemContent(raw) ? null : SCOPE_REQUIRED_MESSAGE;
}

export const DATE_RANGE_MESSAGE = "The end date cannot be before the start date.";

/**
 * True when `end` is on or after `start` (a single-day range is valid). Malformed dates are
 * NOT flagged here - that is the job of a dedicated date-format check (e.g. class-validator's
 * `@IsDateString` on the backend) - so this always returns true for unparseable input rather
 * than producing a confusing, unrelated error.
 */
export function isValidDateRange(start: string, end: string): boolean {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return true;
  return endMs >= startMs;
}

/** Throws-free date-range check for a form to call before submit. */
export function validateDateRange(start: string, end: string): string | null {
  return isValidDateRange(start, end) ? null : DATE_RANGE_MESSAGE;
}
