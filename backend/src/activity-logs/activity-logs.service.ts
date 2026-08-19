import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateActivityLogInput {
  userId: string;
  userEmail: string;
  userName: string;
  action: string;
  details: string;
}

@Injectable()
export class ActivityLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreateActivityLogInput) {
    return this.prisma.activityLog.create({ data });
  }

  async remove(id: string): Promise<boolean> {
    await this.prisma.activityLog.delete({ where: { id } });
    return true;
  }
}
