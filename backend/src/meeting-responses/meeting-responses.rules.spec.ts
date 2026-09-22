import {
  departmentProgress,
  getResponseWindow,
  isBlankHtml,
  todayInTimeZone,
} from './meeting-responses.rules';
import { sanitizeConcern } from './sanitize-concern';

const base = {
  meetingStatus: 'RELEASED',
  meetingDate: '2026-10-06',
  planStatus: 'RELEASED',
  annualPlanStatus: 'APPROVED',
  today: '2026-10-01',
};

describe('getResponseWindow', () => {
  it('is open for a released meeting on a released plan before its date', () => {
    expect(getResponseWindow(base)).toEqual({ open: true });
  });

  it('stays open on the meeting day itself', () => {
    expect(getResponseWindow({ ...base, today: '2026-10-06' }).open).toBe(true);
  });

  it('closes the day after the meeting date', () => {
    expect(getResponseWindow({ ...base, today: '2026-10-07' })).toEqual({
      open: false,
      reason: 'MEETING_DATE_PASSED',
    });
  });

  it.each([
    ['DRAFT', 'MEETING_NOT_RELEASED'],
    ['SUBMITTED_FOR_APPROVAL', 'MEETING_NOT_RELEASED'],
  ])('is closed while the meeting is %s', (meetingStatus, reason) => {
    expect(getResponseWindow({ ...base, meetingStatus })).toEqual({
      open: false,
      reason,
    });
  });

  it('is closed once the OE Plan is closed', () => {
    expect(getResponseWindow({ ...base, planStatus: 'CLOSED' })).toEqual({
      open: false,
      reason: 'PLAN_NOT_RELEASED',
    });
  });

  it('is closed when the Annual Plan is not approved', () => {
    expect(getResponseWindow({ ...base, annualPlanStatus: 'DRAFT' })).toEqual({
      open: false,
      reason: 'ANNUAL_PLAN_NOT_APPROVED',
    });
  });

  it('has no deadline when the meeting date is empty or malformed', () => {
    expect(getResponseWindow({ ...base, meetingDate: '' }).open).toBe(true);
    expect(getResponseWindow({ ...base, meetingDate: '06/10/2026' }).open).toBe(
      true,
    );
  });
});

describe('departmentProgress', () => {
  it('tracks open meetings by whether anyone has answered', () => {
    expect(departmentProgress({ open: true }, 0)).toBe('AWAITING');
    expect(departmentProgress({ open: true }, 1)).toBe('RESPONDED');
  });

  it('is done only when read-only with at least one response', () => {
    const closed = { open: false, reason: 'MEETING_DATE_PASSED' as const };
    expect(departmentProgress(closed, 1)).toBe('DONE');
    expect(departmentProgress(closed, 3)).toBe('DONE');
    expect(departmentProgress(closed, 0)).toBe('MISSED');
  });
});

describe('todayInTimeZone', () => {
  it('uses the company time zone, not UTC', () => {
    // Phnom Penh is UTC+7, so 20:00 UTC on 1 Oct is already 03:00 on 2 Oct locally.
    const instant = new Date('2026-10-01T20:00:00Z');
    expect(todayInTimeZone('Asia/Phnom_Penh', instant)).toBe('2026-10-02');
    expect(todayInTimeZone('UTC', instant)).toBe('2026-10-01');
  });
});

describe('isBlankHtml', () => {
  it('treats an empty editor as blank', () => {
    expect(isBlankHtml('')).toBe(true);
    expect(isBlankHtml('<p></p>')).toBe(true);
    expect(isBlankHtml('<p>&nbsp;</p>')).toBe(true);
    expect(isBlankHtml('<p>Real concern</p>')).toBe(false);
  });
});

describe('sanitizeConcern', () => {
  it('keeps normal formatting', () => {
    const html = '<p>Needs <strong>more</strong> time</p><ul><li>one</li></ul>';
    expect(sanitizeConcern(html)).toBe(html);
  });

  it('strips scripts and event handlers', () => {
    const out = sanitizeConcern(
      '<p onclick="alert(1)">hi</p><script>alert(1)</script><img src=x onerror=alert(1)>',
    );
    expect(out).not.toMatch(/script|onclick|onerror|<img/i);
    expect(out).toContain('hi');
  });

  it('removes links and styles', () => {
    const out = sanitizeConcern(
      '<a href="javascript:alert(1)">x</a><p style="color:red">y</p>',
    );
    expect(out).not.toMatch(/<a|href|style/i);
    expect(out).toContain('y');
  });

  it('keeps table structure and colspan', () => {
    expect(
      sanitizeConcern('<table><tr><td colspan="2">a</td></tr></table>'),
    ).toContain('colspan="2"');
  });

  it('caps very long input', () => {
    expect(sanitizeConcern('a'.repeat(50_000)).length).toBeLessThanOrEqual(
      20_000,
    );
  });
});
