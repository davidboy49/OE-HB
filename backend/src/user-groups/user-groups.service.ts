import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS } from '../common/permissions';
import type { UserGroup } from '@auditdesk/shared';

@Injectable()
export class UserGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<UserGroup[]> {
    const groups = await this.prisma.userGroup.findMany({
      orderBy: { name: 'asc' },
    });
    return groups.map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
    }));
  }

  async create(name: string, description: string): Promise<UserGroup> {
    const group = await this.prisma.userGroup.create({
      data: { name, description },
    });
    return {
      id: group.id,
      name: group.name,
      description: group.description,
    };
  }

  /** All known capability keys + descriptions, for rendering the permission matrix. */
  listAllPermissions() {
    return PERMISSIONS;
  }

  async getGroupPermissions(groupId: string): Promise<string[]> {
    const group = await this.prisma.userGroup.findUnique({
      where: { id: groupId },
      select: { permissions: { select: { key: true } } },
    });
    return group?.permissions.map((p) => p.key) ?? [];
  }

  async setGroupPermissions(
    groupId: string,
    permissionKeys: string[],
  ): Promise<string[]> {
    const group = await this.prisma.userGroup.update({
      where: { id: groupId },
      data: {
        permissions: {
          set: permissionKeys.map((key) => ({ key })),
        },
      },
      select: { permissions: { select: { key: true } } },
    });
    return group.permissions.map((p) => p.key);
  }
}
