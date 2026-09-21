import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

const mockVerify = jest.fn();
jest.mock('jose', () => ({
  createRemoteJWKSet: () => ({}),
  jwtVerify: (...args: unknown[]) => mockVerify(...args) as unknown,
}));

import { KeycloakService } from './keycloak.service';

function makeService(env: Record<string, string> = {}) {
  const config = {
    get: (k: string) =>
      ({ KEYCLOAK_ISSUER: 'https://sso.test/realms/corp', ...env })[k],
  } as unknown as ConfigService;
  return new KeycloakService(config);
}

const good = {
  sub: 'kc-1',
  email: 'dara@corp.com',
  email_verified: true,
  name: 'Dara',
  preferred_username: 'dara',
  azp: 'oe-portal',
  aud: 'account',
  groups: ['/finance', '/oe-team', 42],
};

describe('KeycloakService.verify', () => {
  beforeEach(() => mockVerify.mockReset());

  it('returns the permanent id, verified flag and groups from a valid token', async () => {
    mockVerify.mockResolvedValue({ payload: good });
    await expect(makeService().verify('t')).resolves.toEqual({
      sub: 'kc-1',
      email: 'dara@corp.com',
      emailVerified: true,
      name: 'Dara',
      preferredUsername: 'dara',
      groups: ['/finance', '/oe-team'],
    });
  });

  it('treats a missing email_verified claim as NOT verified', async () => {
    mockVerify.mockResolvedValue({
      payload: { ...good, email_verified: undefined },
    });
    const claims = await makeService().verify('t');
    expect(claims.emailVerified).toBe(false);
  });

  it('rejects a token that fails signature/issuer/expiry checks', async () => {
    mockVerify.mockRejectedValue(new Error('bad signature'));
    await expect(makeService().verify('t')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token with no subject or no email', async () => {
    mockVerify.mockResolvedValue({ payload: { ...good, sub: undefined } });
    await expect(makeService().verify('t')).rejects.toThrow(/no subject/);
    mockVerify.mockResolvedValue({ payload: { ...good, email: undefined } });
    await expect(makeService().verify('t')).rejects.toThrow(/no email/);
  });

  describe('KEYCLOAK_CLIENT_ID', () => {
    it('is not checked when unset', async () => {
      mockVerify.mockResolvedValue({ payload: { ...good, azp: 'other-app' } });
      await expect(makeService().verify('t')).resolves.toBeDefined();
    });

    it('accepts a token issued to (azp) or for (aud) this client', async () => {
      const svc = makeService({ KEYCLOAK_CLIENT_ID: 'oe-portal' });
      mockVerify.mockResolvedValue({ payload: good });
      await expect(svc.verify('t')).resolves.toBeDefined();
      mockVerify.mockResolvedValue({
        payload: { ...good, azp: 'mobile', aud: ['account', 'oe-portal'] },
      });
      await expect(svc.verify('t')).resolves.toBeDefined();
    });

    it('rejects a token minted for another app in the same realm', async () => {
      const svc = makeService({ KEYCLOAK_CLIENT_ID: 'oe-portal' });
      mockVerify.mockResolvedValue({
        payload: { ...good, azp: 'hr-app', aud: 'account' },
      });
      await expect(svc.verify('t')).rejects.toThrow(
        /not issued for the OE Portal/,
      );
    });
  });
});
