import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsResolverService } from '../common/permissions-resolver.service';
import { KeycloakService } from './keycloak.service';
import type { AuthenticatedUser } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly permissionsResolver: PermissionsResolverService,
    private readonly keycloakService: KeycloakService,
  ) {}

  /**
   * Resolves a login identifier to a user: an exact email, or - when it has no "@" -
   * a bare username matching the part of the email before the "@" (so "oe" finds
   * oe@oe.com). A bare username is only accepted when it matches exactly one account.
   */
  private async findUserByLogin(identifier: string) {
    const login = identifier.trim();
    const exact = await this.prisma.user.findUnique({ where: { email: login } });
    if (exact || login.includes('@')) return exact;

    const matches = await this.prisma.user.findMany({
      where: { email: { startsWith: `${login}@`, mode: 'insensitive' } },
      take: 2,
    });
    return matches.length === 1 ? matches[0] : null;
  }

  /** Used by LocalStrategy. Throws (not just returns null) so Passport surfaces a clean 401. */
  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser> {
    const user = await this.findUserByLogin(email);
    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'Password not set for this account - contact an admin',
      );
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid username or password');
    }

    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role as AuthenticatedUser['role'],
      departmentId: user.departmentId,
    };
  }

  /** Fresh-from-DB profile for the authenticated user (used by GET /auth/me). */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { department: true, group: true },
    });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    const permissions = await this.permissionsResolver.getEffectivePermissions(
      user.id,
    );
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId,
      groupId: user.groupId,
      departmentName: user.department?.name ?? null,
      groupName: user.group?.name ?? null,
      permissions,
    };
  }

  /**
   * Exchanges a Keycloak access token (from the mobile app's existing SSO
   * login) for our own JWT. The Keycloak account must map to an existing
   * OE Portal user by email - we don't self-provision accounts here, since
   * role/department/permissions are assigned deliberately by an admin.
   */
  async validateSso(keycloakToken: string): Promise<AuthenticatedUser> {
    const claims = await this.keycloakService.verify(keycloakToken);

    const user = await this.prisma.user.findUnique({
      where: { email: claims.email },
    });
    if (!user) {
      throw new UnauthorizedException(
        `No OE Portal account found for ${claims.email} - contact an admin`,
      );
    }

    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role as AuthenticatedUser['role'],
      departmentId: user.departmentId,
    };
  }

  async login(
    user: AuthenticatedUser,
  ): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    return {
      accessToken: await this.jwtService.signAsync(user),
      user,
    };
  }

  async setPassword(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}
