import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { Department } from '@oeportal/shared';

type DepartmentWithBu = Prisma.DepartmentGetPayload<{
  include: { businessUnit: true };
}>;

const toDto = (d: DepartmentWithBu): Department => ({
  id: d.id,
  code: d.code,
  name: d.name,
  description: d.description,
  isActive: d.isActive,
  businessUnitId: d.businessUnitId,
  businessUnitName: d.businessUnit?.name ?? null,
});

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Department[]> {
    const rows = await this.prisma.department.findMany({
      include: { businessUnit: true },
      orderBy: [{ businessUnit: { name: 'asc' } }, { name: 'asc' }],
    });
    return rows.map(toDto);
  }

  private async assertBusinessUnit(businessUnitId: string) {
    const bu = await this.prisma.businessUnit.findUnique({
      where: { id: businessUnitId },
    });
    if (!bu) throw new BadRequestException('Business Unit not found');
  }

  async create(
    code: string,
    name: string,
    description: string,
    businessUnitId: string,
  ): Promise<Department> {
    await this.assertBusinessUnit(businessUnitId);
    try {
      const d = await this.prisma.department.create({
        data: { code, name, description, businessUnitId },
        include: { businessUnit: true },
      });
      return toDto(d);
    } catch (e) {
      throw this.translate(e);
    }
  }

  async update(
    id: string,
    name: string,
    description: string,
    businessUnitId: string,
  ): Promise<Department> {
    await this.assertBusinessUnit(businessUnitId);
    // Moving a department would rewrite the Business Unit on all of its existing projects and
    // can collide with a same-named department in the target BU. Legacy rows with no BU yet
    // can still be assigned one.
    const current = await this.prisma.department.findUnique({
      where: { id },
      select: { businessUnitId: true },
    });
    if (current?.businessUnitId && current.businessUnitId !== businessUnitId) {
      throw new BadRequestException(
        "A department can't be moved to another Business Unit. Create it in the other Business Unit and deactivate this one.",
      );
    }
    try {
      const d = await this.prisma.department.update({
        where: { id },
        data: { name, description, businessUnitId },
        include: { businessUnit: true },
      });
      // Projects and meetings carry the department/BU names as text for display -
      // keep them in step when either changes.
      await this.prisma.project.updateMany({
        where: { departmentId: id },
        data: { topic: d.name, bu: d.businessUnit?.name ?? '' },
      });
      await this.prisma.openMeeting.updateMany({
        where: { departmentId: id },
        data: { departments: d.name },
      });
      return toDto(d);
    } catch (e) {
      throw this.translate(e);
    }
  }

  // Departments are deactivated, not deleted: they stay on existing users, projects and
  // meetings, and just stop being offered for new ones.
  async setActive(id: string, isActive: boolean): Promise<Department> {
    const d = await this.prisma.department.update({
      where: { id },
      data: { isActive },
      include: { businessUnit: true },
    });
    return toDto(d);
  }

  private translate(e: unknown) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      return new ConflictException(
        'A department with this code or description already exists in this Business Unit.',
      );
    }
    return e;
  }
}
