import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Attachment } from '@oeportal/shared';

@Injectable()
export class AttachmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Mirrors dbService.assertProjectNotClosed: blocks writes linked to a CLOSED OE plan. */
  private async assertProjectNotClosed(projectId?: string): Promise<void> {
    if (!projectId) return;
    const proj = await this.prisma.oePlan.findUnique({
      where: { id: projectId },
    });
    if (proj && proj.status === 'CLOSED') {
      throw new BadRequestException(
        'This OE Plan is CLOSED. No modifications or new records can be linked to a closed OE plan.',
      );
    }
  }

  async create(
    projectId: string,
    fileName: string,
    fileSize: number,
    fileType: string,
    fileData: string,
  ): Promise<Attachment> {
    await this.assertProjectNotClosed(projectId);
    const a = await this.prisma.attachment.create({
      data: {
        projectId,
        fileName,
        fileSize,
        fileType,
        fileData,
      },
    });
    return {
      id: a.id,
      fileName: a.fileName,
      fileSize: a.fileSize,
      fileType: a.fileType,
      fileData: a.fileData,
      projectId: a.projectId,
      createdAt: a.createdAt.toISOString(),
    };
  }

  async remove(id: string): Promise<boolean> {
    await this.prisma.attachment.delete({
      where: { id },
    });
    return true;
  }
}
