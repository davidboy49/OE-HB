import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Mirrors dbService.assertProjectNotClosed. Blocks writes linked to a CLOSED audit project. */
export async function assertProjectNotClosed(
  prisma: PrismaService,
  projectId?: string,
): Promise<void> {
  if (!projectId) return;
  const proj = await prisma.auditProject.findUnique({
    where: { id: projectId },
  });
  if (proj && proj.status === 'CLOSED') {
    throw new BadRequestException(
      'This Audit Plan is CLOSED. No modifications or new records can be linked to a closed audit plan.',
    );
  }
}

/**
 * Blocks creating a child record (Open Meeting, Execution Schedule) until the
 * parent Individual Audit Plan has been officially RELEASED. Strictly stronger
 * than assertProjectNotClosed - a CLOSED project also fails this check.
 */
export async function assertProjectReleased(
  prisma: PrismaService,
  projectId?: string,
): Promise<void> {
  if (!projectId) return;
  const proj = await prisma.auditProject.findUnique({
    where: { id: projectId },
  });
  if (!proj || proj.status !== 'RELEASED') {
    throw new BadRequestException(
      'This Individual Audit Plan must be RELEASED before Open Meetings or Execution Schedules can be created for it.',
    );
  }
}
