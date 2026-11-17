import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Generates unique, perpetually-incrementing document codes: [PREFIX]-[SEQUENCE]
 * Example: OEP-0001, OEP-0002, ...
 *
 * Deliberately not year-scoped: OE Plan codes used to reset to 0001 every
 * calendar year (AP-2026-0001), which made the number meaningless as a
 * stable, sortable identifier once a plan spanned a year boundary. The
 * sequence now lives under a single per-prefix key, starts at 0001, and
 * never resets.
 */
@Injectable()
export class CodeGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates the next unique document code, incrementing the persisted counter.
   *
   * @param prefix Document type prefix (e.g., "OEP").
   * @param digits Number of zero-padded digits (default 4).
   */
  async generateDocumentCode(
    prefix: string = 'OEP',
    digits: number = 4,
  ): Promise<string> {
    const key = prefix.trim().toUpperCase();

    const sequence = await this.prisma.documentSequence.upsert({
      where: { key },
      update: { currentVal: { increment: 1 } },
      create: { key, currentVal: 1 },
    });

    const seqStr = String(sequence.currentVal).padStart(digits, '0');
    return `${key}-${seqStr}`;
  }
}
