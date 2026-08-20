import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsResolverService } from '../common/permissions-resolver.service';
import type { AuthenticatedUser } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly permissionsResolver: PermissionsResolverService,
  ) {}

  /** Used by LocalStrategy. Throws (not just returns null) so Passport surfaces a clean 401. */
  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'Password not set for this account - contact an admin',
      );
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid email or password');
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
      user.role as AuthenticatedUser['role'],
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
