/**
 * These rules live in @oeportal/shared so the frontend can pre-check them before submitting
 * and the backend can enforce them authoritatively, without the two ever drifting apart.
 * Exercised from the backend package (which already has Jest wired up) since the shared
 * package itself has no test runner.
 */
import {
  DATE_RANGE_MESSAGE,
  SCOPE_REQUIRED_MESSAGE,
  isValidDateRange,
  validateDateRange,
  validateScope,
} from '@oeportal/shared';

describe('isValidDateRange / validateDateRange', () => {
  it('accepts an end date after the start date', () => {
    expect(isValidDateRange('2026-10-05', '2026-10-09')).toBe(true);
    expect(validateDateRange('2026-10-05', '2026-10-09')).toBeNull();
  });

  it('accepts a single-day range (end === start)', () => {
    expect(isValidDateRange('2026-10-05', '2026-10-05')).toBe(true);
  });

  it('rejects an end date before the start date', () => {
    expect(isValidDateRange('2026-10-09', '2026-10-05')).toBe(false);
    expect(validateDateRange('2026-10-09', '2026-10-05')).toBe(
      DATE_RANGE_MESSAGE,
    );
  });

  it('works across full ISO timestamps, not just date-only strings', () => {
    expect(
      isValidDateRange('2026-10-05T09:00:00.000Z', '2026-10-05T17:00:00.000Z'),
    ).toBe(true);
    expect(
      isValidDateRange('2026-10-05T17:00:00.000Z', '2026-10-05T09:00:00.000Z'),
    ).toBe(false);
  });

  it('leaves unparseable input to a dedicated format check instead of flagging it here', () => {
    expect(isValidDateRange('not-a-date', '2026-10-05')).toBe(true);
    expect(isValidDateRange('2026-10-05', 'not-a-date')).toBe(true);
  });
});

describe('validateScope', () => {
  it('rejects empty, whitespace-only, or an empty item list', () => {
    expect(validateScope(undefined)).toBe(SCOPE_REQUIRED_MESSAGE);
    expect(validateScope('')).toBe(SCOPE_REQUIRED_MESSAGE);
    expect(validateScope('[]')).toBe(SCOPE_REQUIRED_MESSAGE);
    expect(validateScope(JSON.stringify([{ id: 'x', text: '   ' }]))).toBe(
      SCOPE_REQUIRED_MESSAGE,
    );
  });

  it('accepts at least one item with real text', () => {
    expect(
      validateScope(JSON.stringify([{ id: 'x', text: 'Receiving' }])),
    ).toBeNull();
  });
});
