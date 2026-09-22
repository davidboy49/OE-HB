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
  name: d.name,
  description: d.description,
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
    id: string,
    name: string,
    description: string,
    businessUnitId: string,
  ): Promise<Department> {
    await this.assertBusinessUnit(businessUnitId);
    try {
      const d = await this.prisma.department.create({
        data: { id, name, description, businessUnitId },
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

  async remove(id: string): Promise<boolean> {
    await this.prisma.user.updateMany({
      where: { departmentId: id },
      data: { departmentId: null },
    });
    await this.prisma.department.delete({ where: { id } });
    return true;
  }

  private translate(e: unknown) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      return new ConflictException(
        'A department with this name already exists in this Business Unit.',
      );
    }
    return e;
  }
}
