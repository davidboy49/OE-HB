import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AttachmentStorageRegistry } from './attachment-storage';

/** Per-file cap. Also enforced by the upload route's multer limit (FINDING_ATTACHMENT_MAX_BYTES). */
export const FINDING_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

/** What a finding row carries for each file - the same shape the UI used, minus the bytes. */
export interface FindingAttachmentMeta {
  id: string;
  name: string;
  size: number;
  type: string;
}

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class FindingAttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: AttachmentStorageRegistry,
  ) {}

  /**
   * Stores one file against a finding row. `requireExistingRow` is set for resolve-only callers:
   * they may only attach to a row already on the report, while an editor may attach to a new
   * row that's still being drafted (its id is generated client-side before the report save).
   */
  async upload(
    scheduleId: string,
    rowId: string,
    file: UploadedFile | undefined,
    actorName: string,
    requireExistingRow: boolean,
  ): Promise<FindingAttachmentMeta> {
    if (!file) throw new BadRequestException('No file was uploaded.');
    if (file.size > FINDING_ATTACHMENT_MAX_BYTES) {
      throw new BadRequestException('Files can be at most 25 MB.');
    }

    const schedule = await this.prisma.executionSchedule.findUnique({
      where: { id: scheduleId },
      select: { isDeleted: true, language: true, scheduleRows: true },
    });
    if (!schedule || schedule.isDeleted) {
      throw new NotFoundException('Execution Schedule not found');
    }
    if (schedule.language !== 'finding') {
      throw new BadRequestException(
        'Attachments are only allowed on OE Findings rows.',
      );
    }
    if (requireExistingRow && !rowIdsOf(schedule.scheduleRows).has(rowId)) {
      throw new NotFoundException('Finding row not found');
    }

    const writer = this.storage.forWrite();
    const created = await this.prisma.findingAttachment.create({
      data: {
        scheduleId,
        rowId,
        // Browsers send the name latin1-decoded by multer; restore UTF-8 (e.g. Khmer names).
        name: Buffer.from(file.originalname, 'latin1').toString('utf8'),
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size,
        storage: writer.driver,
        uploadedBy: actorName,
      },
    });
    try {
      const storageKey = await writer.put(created.id, file.buffer);
      if (storageKey) {
        await this.prisma.findingAttachment.update({
          where: { id: created.id },
          data: { storageKey },
        });
      }
    } catch (err) {
      // Don't leave metadata pointing at bytes that were never written.
      await this.prisma.findingAttachment.delete({ where: { id: created.id } });
      throw err;
    }
    return toMeta(created);
  }

  async download(
    scheduleId: string,
    attachmentId: string,
  ): Promise<{ meta: FindingAttachmentMeta; data: Buffer }> {
    const att = await this.prisma.findingAttachment.findFirst({
      where: { id: attachmentId, scheduleId, isDeleted: false },
    });
    if (!att) throw new NotFoundException('Attachment not found');
    const data = await this.storage
      .forDriver(att.storage)
      .get(att.id, att.storageKey);
    if (!data) throw new NotFoundException('Attachment file is missing');
    return { meta: toMeta(att), data };
  }

  /**
   * Soft delete. `requireExistingRow` mirrors upload(): a resolve-only caller may only remove
   * files from rows that are actually on the report.
   */
  async remove(
    scheduleId: string,
    attachmentId: string,
    requireExistingRow: boolean,
  ): Promise<void> {
    const att = await this.prisma.findingAttachment.findFirst({
      where: { id: attachmentId, scheduleId, isDeleted: false },
      select: { id: true, rowId: true },
    });
    if (!att) throw new NotFoundException('Attachment not found');
    if (requireExistingRow) {
      const schedule = await this.prisma.executionSchedule.findUnique({
        where: { id: scheduleId },
        select: { scheduleRows: true },
      });
      if (!rowIdsOf(schedule?.scheduleRows).has(att.rowId)) {
        throw new NotFoundException('Finding row not found');
      }
    }
    await this.prisma.findingAttachment.update({
      where: { id: attachmentId },
      data: { isDeleted: true },
    });
  }

  /** Live files per schedule id, then per row id, in upload order. */
  async metaBySchedule(
    scheduleIds: string[],
  ): Promise<Map<string, Map<string, FindingAttachmentMeta[]>>> {
    const bySchedule = new Map<string, Map<string, FindingAttachmentMeta[]>>();
    if (scheduleIds.length === 0) return bySchedule;
    const rows = await this.prisma.findingAttachment.findMany({
      where: { scheduleId: { in: scheduleIds }, isDeleted: false },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        scheduleId: true,
        rowId: true,
        name: true,
        size: true,
        mimeType: true,
      },
    });
    for (const r of rows) {
      const byRow =
        bySchedule.get(r.scheduleId) ??
        new Map<string, FindingAttachmentMeta[]>();
      const list = byRow.get(r.rowId) ?? [];
      list.push(toMeta(r));
      byRow.set(r.rowId, list);
      bySchedule.set(r.scheduleId, byRow);
    }
    return bySchedule;
  }

  /** Soft-deletes the files of rows removed from a report by a save (e.g. a deleted finding row). */
  async removeForRows(scheduleId: string, rowIds: string[]): Promise<void> {
    if (rowIds.length === 0) return;
    await this.prisma.findingAttachment.updateMany({
      where: { scheduleId, rowId: { in: rowIds }, isDeleted: false },
      data: { isDeleted: true },
    });
  }
}

function toMeta(a: {
  id: string;
  name: string;
  size: number;
  mimeType: string;
}): FindingAttachmentMeta {
  return { id: a.id, name: a.name, size: a.size, type: a.mimeType };
}

export function rowIdsOf(scheduleRows: string | null | undefined): Set<string> {
  try {
    const rows: unknown = JSON.parse(scheduleRows || '[]');
    if (!Array.isArray(rows)) return new Set();
    return new Set(
      rows
        .map((r: { id?: unknown }) => r?.id)
        .filter((id): id is string => typeof id === 'string'),
    );
  } catch {
    return new Set();
  }
}
