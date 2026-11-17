import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { BusinessUnit } from '@oeportal/shared';

@Injectable()
export class BusinessUnitsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<BusinessUnit[]> {
    return this.prisma.businessUnit.findMany({ orderBy: { name: 'asc' } });
  }

  async create(
    id: string,
    name: string,
    description: string,
  ): Promise<BusinessUnit> {
    return this.prisma.businessUnit.create({ data: { id, name, description } });
  }

  async update(
    id: string,
    name: string,
    description: string,
  ): Promise<BusinessUnit> {
    return this.prisma.businessUnit.update({
      where: { id },
      data: { name, description },
    });
  }

  async remove(id: string): Promise<boolean> {
    await this.prisma.businessUnit.delete({ where: { id } });
    return true;
  }
}
