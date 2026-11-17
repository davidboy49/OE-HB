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
  /** Roles whose keycloakGroup is set - candidates for group sync. */
  linkedGroups?: {
    id: string;
    name: string;
    keycloakGroup: string;
    grants: number;
  }[];
}) {
  // The one row `user.update` mutates, whichever lookup found it - so a group-sync update
  // sees the same record an earlier linking update already touched.
  const record: Record<string, unknown> | null = (opts.bySub ??
    opts.byEmail ??
    null) as Record<string, unknown> | null;
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(opts.bySub ?? null),
      findFirst: jest.fn().mockResolvedValue(opts.byEmail ?? null),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          Object.assign(record ?? {}, data);
          return Promise.resolve({ ...record, ...data });
        }),
    },
    userGroup: {
      // Mirrors the real query: only roles whose keycloakGroup is one of the requested names.
      findMany: jest.fn(
        ({ where }: { where: { keycloakGroup: { in: string[] } } }) =>
          Promise.resolve(
            (opts.linkedGroups ?? [])
              .filter((g) => where.keycloakGroup.in.includes(g.keycloakGroup))
              .map((g) => ({
                id: g.id,
                name: g.name,
                keycloakGroup: g.keycloakGroup,
                _count: { grants: g.grants },
              })),
          ),
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

describe('AuthService.validateSso - group sync from Keycloak', () => {
  it('does nothing when the token carries no groups', async () => {
    const { service, prisma } = setup({
      bySub: account({ groupId: 'existing' }),
      claims: claims({ groups: [] }),
      linkedGroups: [
        { id: 'g1', name: 'Finance', keycloakGroup: '/finance', grants: 5 },
      ],
    });
    const result = await service.validateSso('t');
    expect(prisma.userGroup.findMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({ sub: 'u1' });
  });

  it('leaves the group untouched when no linked role matches (never clears it)', async () => {
    const { service, prisma } = setup({
      bySub: account({ groupId: 'existing' }),
      claims: claims({ groups: ['/marketing'] }),
      linkedGroups: [
        { id: 'g1', name: 'Finance', keycloakGroup: '/finance', grants: 5 },
      ],
    });
    await service.validateSso('t');
    expect(prisma.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ groupId: expect.anything() }),
      }),
    );
  });

  it('moves the person into the matching linked role', async () => {
    const { service, prisma } = setup({
      bySub: account({ groupId: null }),
      claims: claims({ groups: ['/finance'] }),
      linkedGroups: [
        { id: 'g1', name: 'Finance', keycloakGroup: '/finance', grants: 5 },
      ],
    });
    await service.validateSso('t');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { groupId: 'g1' },
    });
  });

  it('does not write when already in the matching role', async () => {
    const { service, prisma } = setup({
      bySub: account({ groupId: 'g1' }),
      claims: claims({ groups: ['/finance'] }),
      linkedGroups: [
        { id: 'g1', name: 'Finance', keycloakGroup: '/finance', grants: 5 },
      ],
    });
    await service.validateSso('t');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('picks the most-privileged role when several linked roles match', async () => {
    const { service, prisma } = setup({
      bySub: account({ groupId: null }),
      claims: claims({ groups: ['/finance', '/leads'] }),
      linkedGroups: [
        {
          id: 'g-narrow',
          name: 'Finance',
          keycloakGroup: '/finance',
          grants: 5,
        },
        { id: 'g-wide', name: 'Leads', keycloakGroup: '/leads', grants: 20 },
      ],
    });
    await service.validateSso('t');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { groupId: 'g-wide' },
    });
  });

  it('never creates a role for an unmapped Keycloak group', async () => {
    const { service, prisma } = setup({
      bySub: account({ groupId: null }),
      claims: claims({ groups: ['/unmapped-group'] }),
      linkedGroups: [],
    });
    await service.validateSso('t');
    expect(prisma.userGroup.findMany).toHaveBeenCalledWith({
      where: { keycloakGroup: { in: ['/unmapped-group'] } },
      include: { _count: { select: { grants: true } } },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
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
