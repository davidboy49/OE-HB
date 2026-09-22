import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth.types';

const token: AuthenticatedUser = {
  sub: 'u1',
  email: 'old@corp.com',
  name: 'Old Name',
  role: 'ADMIN',
  departmentId: 'old-dept',
};

function makeStrategy(row: unknown) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(row) },
  } as unknown as PrismaService;
  const config = { get: () => 'test-secret' } as unknown as ConfigService;
  return new JwtStrategy(config, prisma);
}

describe('JwtStrategy.validate', () => {
  it('rejects a token whose account was deleted', async () => {
    await expect(makeStrategy(null).validate(token)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token whose account was deactivated, even though the token is still valid', async () => {
    const strategy = makeStrategy({ id: 'u1', isActive: false });
    await expect(strategy.validate(token)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('uses the profile from the database, not the (possibly stale) token', async () => {
    const strategy = makeStrategy({
      id: 'u1',
      email: 'new@corp.com',
      name: 'New Name',
      role: 'OE_MEMBER',
      departmentId: 'new-dept',
      isActive: true,
    });
    await expect(strategy.validate(token)).resolves.toEqual({
      sub: 'u1',
      email: 'new@corp.com',
      name: 'New Name',
      role: 'OE_MEMBER', // demoted since the token was signed
      departmentId: 'new-dept',
    });
  });
});
