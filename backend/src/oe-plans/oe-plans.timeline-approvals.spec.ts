import {
  BLANK_APPROVALS_FIELDS,
  BLANK_OPEX_TIMELINE_FIELDS,
  parseApprovals,
  parseOpExTimeline,
  serializeApprovals,
  serializeOpExTimeline,
} from './oe-plans.service';

/**
 * opExTimeline/approvals moved from a JSON-blob column to real, flat columns (see the
 * flatten_oe_plan_timeline_and_approvals migration). The wire format is deliberately
 * unchanged - these functions are the only place that translate between the two, so they
 * carry the risk of the whole change and are worth testing directly.
 */
describe('serializeOpExTimeline / parseOpExTimeline round trip', () => {
  it('serializes the flat columns back into the exact wire shape', () => {
    const json = serializeOpExTimeline({
      opExPresentationDate: '2026-01-01',
      opExNotificationDate: '2026-01-02',
      opExFieldWorkStart: '2026-01-05',
      opExFieldWorkEnd: '2026-01-10',
      opExFindingReportOffset: 5,
      opExFinalReportOffset: 10,
    });
    expect(JSON.parse(json)).toEqual({
      presentationDate: '2026-01-01',
      notificationDate: '2026-01-02',
      fieldWorkStart: '2026-01-05',
      fieldWorkEnd: '2026-01-10',
      findingReportOffset: 5,
      finalReportOffset: 10,
    });
  });

  it('parses a full wire payload back into the flat column shape', () => {
    const json = JSON.stringify({
      presentationDate: '2026-01-01',
      notificationDate: '2026-01-02',
      fieldWorkStart: '2026-01-05',
      fieldWorkEnd: '2026-01-10',
      findingReportOffset: 5,
      finalReportOffset: 10,
    });
    expect(parseOpExTimeline(json)).toEqual({
      opExPresentationDate: '2026-01-01',
      opExNotificationDate: '2026-01-02',
      opExFieldWorkStart: '2026-01-05',
      opExFieldWorkEnd: '2026-01-10',
      opExFindingReportOffset: 5,
      opExFinalReportOffset: 10,
    });
  });

  it('returns undefined for undefined input, so a partial update leaves existing columns alone', () => {
    expect(parseOpExTimeline(undefined)).toBeUndefined();
  });

  it('falls back to blanks for an empty string or malformed JSON, instead of throwing', () => {
    expect(parseOpExTimeline('')).toEqual(BLANK_OPEX_TIMELINE_FIELDS);
    expect(parseOpExTimeline('not json')).toEqual(BLANK_OPEX_TIMELINE_FIELDS);
  });

  it('never lets a non-string/non-number field value corrupt the stored shape', () => {
    const json = JSON.stringify({
      presentationDate: { nested: 'object' },
      findingReportOffset: 'not-a-number',
    });
    expect(parseOpExTimeline(json)).toEqual({
      ...BLANK_OPEX_TIMELINE_FIELDS,
    });
  });
});

describe('serializeApprovals / parseApprovals round trip', () => {
  it('serializes the flat columns back into the exact wire shape', () => {
    const json = serializeApprovals({
      preparedByName: 'Dara',
      preparedByTitle: 'OE Member',
      preparedDate: '2026-01-01',
      approvedByName: 'Sok',
      approvedByTitle: 'OE Leader',
      approvedDate: '2026-01-05',
    });
    expect(JSON.parse(json)).toEqual({
      preparedByName: 'Dara',
      preparedByTitle: 'OE Member',
      preparedDate: '2026-01-01',
      approvedByName: 'Sok',
      approvedByTitle: 'OE Leader',
      approvedDate: '2026-01-05',
    });
  });

  it('round-trips parse -> serialize back to the same wire payload', () => {
    const original = {
      preparedByName: 'Dara',
      preparedByTitle: 'OE Member',
      preparedDate: '2026-01-01',
      approvedByName: '',
      approvedByTitle: '',
      approvedDate: '',
    };
    const parsed = parseApprovals(JSON.stringify(original));
    expect(JSON.parse(serializeApprovals(parsed!))).toEqual(original);
  });

  it('returns undefined for undefined input', () => {
    expect(parseApprovals(undefined)).toBeUndefined();
  });

  it('falls back to blanks for malformed JSON', () => {
    expect(parseApprovals('{not valid')).toEqual(BLANK_APPROVALS_FIELDS);
  });
});
