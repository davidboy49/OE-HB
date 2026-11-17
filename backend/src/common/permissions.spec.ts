import { PERMISSIONS, PERMISSION_KEYS } from './permissions';

describe('permission catalog', () => {
  it('has unique keys, each with a description', () => {
    expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length);
    for (const p of PERMISSIONS) expect(p.description.trim()).not.toBe('');
  });

  it('uses the module:action shape', () => {
    for (const key of PERMISSION_KEYS) expect(key).toMatch(/^[a-z-]+:[a-z-]+$/);
  });
});
