import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { User } from '../generated/prisma/client';
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
    private readonly config: ConfigService,
  ) {}

  /**
   * Resolves a login identifier to a user: an exact email, or - when it has no "@" -
   * a bare username matching the part of the email before the "@" (so "oe" finds
   * oe@oe.com). A bare username is only accepted when it matches exactly one account.
   */
  private async findUserByLogin(identifier: string) {
    const login = identifier.trim();
    const exact = await this.prisma.user.findUnique({
      where: { email: login },
    });
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
    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
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
    const grants = await this.permissionsResolver.getGrants(user.id);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId,
      groupId: user.groupId,
      departmentName: user.department?.name ?? null,
      groupName: user.group?.name ?? null,
      permissions: Object.keys(grants),
      grants,
    };
  }

  /**
   * Exchanges a Keycloak access token for our own JWT. Keycloak only proves WHO the person is;
   * what they may do stays with the OE Portal (their role, group and department). So:
   *  - accounts are never created here: an admin must have added the person first;
   *  - once linked, the person is recognised by Keycloak's permanent id (`sub`), so a changed
   *    or re-assigned email address can never hand their account to someone else;
   *  - the FIRST sign-in links by email, and only if Keycloak has verified that email (an
   *    unverified address could be claimed by anyone who registers it) and the account is not
   *    already linked to a different Keycloak identity;
   *  - deactivated accounts are refused.
   */
  async validateSso(keycloakToken: string): Promise<AuthenticatedUser> {
    const claims = await this.keycloakService.verify(keycloakToken);

    let user = await this.prisma.user.findUnique({
      where: { keycloakSub: claims.sub },
    });

    if (!user) {
      const requireVerified =
        this.config.get<string>('KEYCLOAK_REQUIRE_VERIFIED_EMAIL') !== 'false';
      if (requireVerified && !claims.emailVerified) {
        throw new UnauthorizedException(
          'Your email address is not verified in Keycloak - verify it there, then sign in again',
        );
      }

      const byEmail = await this.prisma.user.findFirst({
        where: { email: { equals: claims.email, mode: 'insensitive' } },
      });
      if (!byEmail) {
        throw new UnauthorizedException(
          `No OE Portal account found for ${claims.email} - contact an admin`,
        );
      }
      if (byEmail.keycloakSub && byEmail.keycloakSub !== claims.sub) {
        throw new UnauthorizedException(
          'This OE Portal account is already linked to a different SSO identity - contact an admin',
        );
      }
      user = await this.prisma.user.update({
        where: { id: byEmail.id },
        data: { keycloakSub: claims.sub },
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
    }

    user = await this.syncGroupFromKeycloak(user, claims.groups);

    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role as AuthenticatedUser['role'],
      departmentId: user.departmentId,
    };
  }

  /**
   * Membership can follow Keycloak while permissions stay defined here: an admin links an OE
   * role to a Keycloak group name (`UserGroup.keycloakGroup`), and on every SSO sign-in this
   * moves the person into whichever linked role matches one of their current Keycloak groups.
   *
   *  - No match -> the person's group is left exactly as it is. A role with no
   *    `keycloakGroup` set is never touched by this, so a purely local role stays admin-only.
   *  - Several linked roles match -> the one with the most permissions wins (narrowing someone's
   *    access is an admin's explicit decision, not a coin flip on group order).
   *  - Nothing here creates a role: an unmapped Keycloak group is simply ignored.
   */
  private async syncGroupFromKeycloak(
    user: User,
    keycloakGroups: string[],
  ): Promise<User> {
    if (keycloakGroups.length === 0) return user;

    const candidates = await this.prisma.userGroup.findMany({
      where: { keycloakGroup: { in: keycloakGroups } },
      include: { _count: { select: { grants: true } } },
    });
    if (candidates.length === 0) return user;

    const best = candidates.sort(
      (a, b) =>
        b._count.grants - a._count.grants || a.name.localeCompare(b.name),
    )[0];
    if (best.id === user.groupId) return user;

    return this.prisma.user.update({
      where: { id: user.id },
      data: { groupId: best.id },
    });
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
