import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Department } from '@auditdesk/shared';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Department[]> {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' } });
  }

  async create(
    id: string,
    name: string,
    description: string,
  ): Promise<Department> {
    return this.prisma.department.create({ data: { id, name, description } });
  }

  async update(
    id: string,
    name: string,
    description: string,
  ): Promise<Department> {
    return this.prisma.department.update({
      where: { id },
      data: { name, description },
    });
  }

  async remove(id: string): Promise<boolean> {
    await this.prisma.user.updateMany({
      where: { departmentId: id },
      data: { departmentId: null },
    });
    await this.prisma.department.delete({ where: { id } });
    return true;
  }
}
