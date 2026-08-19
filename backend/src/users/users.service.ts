import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import type { User, UserRole } from '@auditdesk/shared';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      include: {
        department: true,
        group: true,
      },
      orderBy: { name: 'asc' },
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role as UserRole,
      departmentId: u.departmentId,
      groupId: u.groupId,
      departmentName: u.department?.name || null,
      groupName: u.group?.name || null,
    }));
  }

  async create(
    name: string,
    email: string,
    role: UserRole,
    departmentId: string | null,
    groupId: string | null,
    password?: string,
  ): Promise<User> {
    const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;
    const u = await this.prisma.user.create({
      data: {
        name,
        email,
        role,
        departmentId,
        groupId,
        passwordHash,
      },
    });
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role as UserRole,
      departmentId: u.departmentId,
      groupId: u.groupId,
    };
  }

  async update(
    userId: string,
    name: string,
    email: string,
    role: UserRole,
    departmentId: string | null,
    groupId: string | null,
  ): Promise<User | null> {
    const u = await this.prisma.user.update({
      where: { id: userId },
      data: { name, email, role, departmentId, groupId },
    });
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role as UserRole,
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
      role: u.role as UserRole,
      departmentId: u.departmentId,
      groupId: u.groupId,
    };
  }

  async remove(userId: string): Promise<boolean> {
    // Delete documents uploaded by this user
    await this.prisma.document.deleteMany({ where: { uploaderId: userId } });
    // Delete findings reported by this user
    await this.prisma.finding.deleteMany({ where: { auditorId: userId } });
    // Delete reports created by this user
    await this.prisma.report.deleteMany({ where: { creatorId: userId } });
    // Set leadAuditorId to null in any projects where they lead
    await this.prisma.auditProject.updateMany({
      where: { leadAuditorId: userId },
      data: { leadAuditorId: null },
    });
    // Safely delete the user
    await this.prisma.user.delete({ where: { id: userId } });
    return true;
  }
}
