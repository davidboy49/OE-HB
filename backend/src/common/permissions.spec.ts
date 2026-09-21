import {
  DEFAULT_PERMISSIONS_BY_ROLE,
  PERMISSIONS,
  PERMISSION_KEYS,
} from './permissions';

describe('permission catalog', () => {
  it('has unique keys, each with a description', () => {
    expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length);
    for (const p of PERMISSIONS) expect(p.description.trim()).not.toBe('');
  });

  it('uses the module:action shape', () => {
    for (const key of PERMISSION_KEYS) expect(key).toMatch(/^[a-z-]+:[a-z-]+$/);
  });

  it('only grants role defaults that exist in the catalog', () => {
    for (const keys of Object.values(DEFAULT_PERMISSIONS_BY_ROLE)) {
      for (const key of keys) expect(PERMISSION_KEYS).toContain(key);
    }
  });
});

describe('role defaults (used by users who are in no group)', () => {
  const roles = DEFAULT_PERMISSIONS_BY_ROLE;

  it('gives ADMIN everything', () => {
    expect(roles.ADMIN).toEqual(PERMISSION_KEYS);
  });

  it('gives OE_LEADER everything except editing SMTP settings', () => {
    expect(roles.OE_LEADER).not.toContain('notifications:configure');
    expect(roles.OE_LEADER).toContain('oe-plans:approve');
    expect(roles.OE_LEADER).toContain('meetings:approve');
    expect(roles.OE_LEADER).toContain('meeting-responses:view-all');
  });

  it('never lets an OE_MEMBER approve, close, reopen or delete', () => {
    const forbidden = roles.OE_MEMBER.filter((k) =>
      /:(approve|close|reopen|delete|view-all|configure)$/.test(k),
    );
    expect(forbidden).toEqual([]);
  });

  it('lets an OE_MEMBER submit but not approve', () => {
    expect(roles.OE_MEMBER).toContain('oe-plans:submit');
    expect(roles.OE_MEMBER).toContain('meetings:submit');
    expect(roles.OE_MEMBER).not.toContain('oe-plans:approve');
    expect(roles.OE_MEMBER).not.toContain('meetings:approve');
  });

  it('keeps a DEPT_PIC to answering meetings and nothing else', () => {
    expect(roles.DEPT_PIC).toEqual([
      'meeting-responses:create',
      'notifications:send',
    ]);
  });
});
