/* eslint-disable @typescript-eslint/unbound-method */
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import type { KeycloakClaims, KeycloakService } from './keycloak.service';
import type { PermissionsResolverService } from '../common/permissions-resolver.service';
import type { PrismaService } from '../prisma/prisma.service';

const claims = (over: Partial<KeycloakClaims> = {}): KeycloakClaims => ({
  sub: 'kc-1',
  email: 'dara@corp.com',
  emailVerified: true,
  name: 'Dara',
  preferredUsername: 'dara',
  groups: [],
  ...over,
});

const account = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  email: 'dara@corp.com',
  name: 'Dara',
  role: 'OE_MEMBER',
  departmentId: 'd1',
  keycloakSub: null,
  isActive: true,
  passwordHash: null,
  ...over,
});

function setup(opts: {
  claims?: KeycloakClaims;
  bySub?: unknown;
  byEmail?: unknown;
  env?: Record<string, string>;
}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(opts.bySub ?? null),
      findFirst: jest.fn().mockResolvedValue(opts.byEmail ?? null),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...(opts.byEmail as object), ...data }),
        ),
    },
  } as unknown as PrismaService;
  const keycloak = {
    verify: jest.fn().mockResolvedValue(opts.claims ?? claims()),
  } as unknown as KeycloakService;
  const config = {
    get: jest.fn((k: string) => opts.env?.[k]),
  } as unknown as ConfigService;
  const service = new AuthService(
    prisma,
    {} as JwtService,
    {} as PermissionsResolverService,
    keycloak,
    config,
  );
  return { service, prisma };
}

describe('AuthService.validateSso', () => {
  it('recognises a returning person by their Keycloak id, ignoring the email', async () => {
    const { service, prisma } = setup({
      claims: claims({ email: 'renamed@corp.com', emailVerified: false }),
      bySub: account({ keycloakSub: 'kc-1' }),
    });
    await expect(service.validateSso('t')).resolves.toMatchObject({
      sub: 'u1',
      email: 'dara@corp.com',
    });
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('links an existing account by verified email on the first sign-in', async () => {
    const { service, prisma } = setup({ byEmail: account() });
    await expect(service.validateSso('t')).resolves.toMatchObject({
      sub: 'u1',
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { keycloakSub: 'kc-1' },
    });
  });

  it('matches the email without regard to letter case', async () => {
    const { service, prisma } = setup({
      claims: claims({ email: 'Dara@Corp.com' }),
      byEmail: account(),
    });
    await service.validateSso('t');
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'Dara@Corp.com', mode: 'insensitive' } },
    });
  });

  it('refuses to link by an UNVERIFIED email (anyone could have registered it)', async () => {
    const { service, prisma } = setup({
      claims: claims({ emailVerified: false }),
      byEmail: account(),
    });
    await expect(service.validateSso('t')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('can be told to accept unverified emails (realms that never verify)', async () => {
    const { service } = setup({
      claims: claims({ emailVerified: false }),
      byEmail: account(),
      env: { KEYCLOAK_REQUIRE_VERIFIED_EMAIL: 'false' },
    });
    await expect(service.validateSso('t')).resolves.toMatchObject({
      sub: 'u1',
    });
  });

  it('never creates an account for someone an admin has not added', async () => {
    const { service, prisma } = setup({});
    await expect(service.validateSso('t')).rejects.toThrow(
      /No OE Portal account/,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses an account already linked to a DIFFERENT Keycloak identity', async () => {
    const { service, prisma } = setup({
      byEmail: account({ keycloakSub: 'someone-else' }),
    });
    await expect(service.validateSso('t')).rejects.toThrow(/already linked/);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses a deactivated account, whether found by id or by email', async () => {
    const byId = setup({
      bySub: account({ isActive: false, keycloakSub: 'kc-1' }),
    });
    await expect(byId.service.validateSso('t')).rejects.toThrow(/deactivated/);

    const byMail = setup({ byEmail: account({ isActive: false }) });
    await expect(byMail.service.validateSso('t')).rejects.toThrow(
      /deactivated/,
    );
  });
});

describe('AuthService.validateUser (password login)', () => {
  it('refuses a deactivated account even with the right password', async () => {
    const hash = await bcrypt.hash('pw', 4);
    const { service, prisma } = setup({});
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(
      account({ isActive: false, passwordHash: hash }),
    );
    await expect(service.validateUser('dara@corp.com', 'pw')).rejects.toThrow(
      /deactivated/,
    );
  });

  it('accepts an active account with the right password', async () => {
    const hash = await bcrypt.hash('pw', 4);
    const { service, prisma } = setup({});
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(
      account({ passwordHash: hash }),
    );
    await expect(
      service.validateUser('dara@corp.com', 'pw'),
    ).resolves.toMatchObject({ sub: 'u1' });
  });
});
