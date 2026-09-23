import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsResolverService } from '../common/permissions-resolver.service';
import type { User } from '@oeportal/shared';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsResolver: PermissionsResolverService,
  ) {}

  async findAll(): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      include: {
        department: true,
        group: true,
      },
      orderBy: { name: 'asc' },
    });
    const permissionsByUser = await Promise.all(
      users.map((u) => this.permissionsResolver.getEffectivePermissions(u.id)),
    );
    return users.map((u, i) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      departmentId: u.departmentId,
      groupId: u.groupId,
      departmentName: u.department?.name || null,
      groupName: u.group?.name || null,
      isActive: u.isActive,
      ssoLinked: u.keycloakSub !== null,
      permissions: permissionsByUser[i],
    }));
  }

  /**
   * Turns an account on or off. A deactivated person cannot sign in and any session they
   * already have stops working on its next request (see JwtStrategy). The last active user
   * who can still manage users (`users:update`) can never be switched off, so the system
   * cannot lock itself out of user management entirely.
   */
  async setActive(userId: string, isActive: boolean): Promise<User> {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('User not found');

    if (!isActive && target.isActive) {
      const managers =
        await this.permissionsResolver.getActiveUserIdsWithPermission(
          'users:update',
        );
      const otherManagers = managers.filter((id) => id !== userId);
      if (managers.includes(userId) && otherManagers.length === 0) {
        throw new BadRequestException(
          'This is the last active user who can manage users - at least one must stay active.',
        );
      }
    }

    const u = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      departmentId: u.departmentId,
      groupId: u.groupId,
      isActive: u.isActive,
      ssoLinked: u.keycloakSub !== null,
    };
  }

  async create(
    name: string,
    email: string,
    departmentId: string | null,
    groupId: string | null,
    password?: string,
  ): Promise<User> {
    const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;
    const u = await this.prisma.user.create({
      data: {
        name,
        email,
        departmentId,
        groupId,
        passwordHash,
      },
    });
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      departmentId: u.departmentId,
      groupId: u.groupId,
    };
  }

  async update(
    userId: string,
    name: string,
    email: string,
    departmentId: string | null,
    groupId: string | null,
  ): Promise<User | null> {
    const u = await this.prisma.user.update({
      where: { id: userId },
      data: { name, email, departmentId, groupId },
    });
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      departmentId: u.departmentId,
      groupId: u.groupId,
    };
  }

  async updateGroupAndDept(
    userId: string,
    departmentId: string | null,
    groupId: string | null,
  ): Promise<User | null> {
    const u = await this.prisma.user.update({
      where: { id: userId },
      data: { departmentId, groupId },
    });
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      departmentId: u.departmentId,
      groupId: u.groupId,
    };
  }

  async remove(userId: string): Promise<boolean> {
    // Delete documents uploaded by this user
    await this.prisma.document.deleteMany({ where: { uploaderId: userId } });
    // Delete findings reported by this user
    await this.prisma.finding.deleteMany({ where: { memberId: userId } });
    // Delete reports created by this user
    await this.prisma.report.deleteMany({ where: { creatorId: userId } });
    // Set leaderId to null in any projects where they lead
    await this.prisma.oePlan.updateMany({
      where: { leaderId: userId },
      data: { leaderId: null },
    });
    // Safely delete the user
    await this.prisma.user.delete({ where: { id: userId } });
    return true;
  }
}
