import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Generates unique document codes using Option B format: [PREFIX]-[YYYY]-[SEQUENCE]
 * Example: AP-2026-0001
 *
 * Ported from src/lib/codeGenerator.ts. The original had a raw-SQL fallback
 * branch for a dev-mode Next.js hot-reload edge case (stale cached Prisma
 * client) - dropped here since it doesn't apply to Nest's DI lifecycle.
 */
@Injectable()
export class CodeGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates the next unique document code, incrementing the persisted counter.
   *
   * @param prefix Document type prefix (e.g., "AP", "ES", "FD", "AR", "DR")
   * @param year Optional year integer. Defaults to current calendar year.
   * @param digits Number of zero-padded digits (default 4).
   */
  async generateDocumentCode(
    prefix: string = 'AP',
    year?: number,
    digits: number = 4,
  ): Promise<string> {
    const targetYear = year || new Date().getFullYear();
    const cleanPrefix = prefix.trim().toUpperCase();
    const key = `${cleanPrefix}-${targetYear}`;

    const sequence = await this.prisma.documentSequence.upsert({
      where: { key },
      update: { currentVal: { increment: 1 } },
      create: { key, currentVal: 1 },
    });
    const currentVal = sequence.currentVal;

    const seqStr = String(currentVal).padStart(digits, '0');
    return `${key}-${seqStr}`;
  }

  /**
   * Previews the next code that will be assigned without incrementing the database counter.
   */
  async getNextDocumentCodePreview(
    prefix: string = 'AP',
    year?: number,
    digits: number = 4,
  ): Promise<string> {
    const targetYear = year || new Date().getFullYear();
    const cleanPrefix = prefix.trim().toUpperCase();
    const key = `${cleanPrefix}-${targetYear}`;

    const seq = await this.prisma.documentSequence.findUnique({
      where: { key },
    });
    const currentVal = seq?.currentVal || 0;

    const nextVal = currentVal + 1;
    const seqStr = String(nextVal).padStart(digits, '0');
    return `${key}-${seqStr}`;
  }
}
