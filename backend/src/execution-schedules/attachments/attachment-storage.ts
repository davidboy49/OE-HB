import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Where finding-attachment bytes live. FindingAttachment.storage records which driver wrote a
 * file, so switching the default (ATTACHMENT_STORAGE_DRIVER) to a new driver - server disk or
 * S3 for production - only needs a new implementation registered in AttachmentStorageRegistry;
 * files already written by the old driver keep being read from where they are.
 */
export interface AttachmentStorage {
  /** Value stored in FindingAttachment.storage. */
  readonly driver: string;
  /** Stores the bytes; returns the storageKey to persist (drivers that key by id return ''). */
  put(attachmentId: string, data: Buffer): Promise<string>;
  /** The bytes, or null when they're missing. */
  get(attachmentId: string, storageKey: string): Promise<Buffer | null>;
}

/** Bytes in the FindingAttachmentBlob table - no extra infrastructure; the development default. */
@Injectable()
export class PostgresAttachmentStorage implements AttachmentStorage {
  readonly driver = 'postgres';

  constructor(private readonly prisma: PrismaService) {}

  async put(attachmentId: string, data: Buffer): Promise<string> {
    await this.prisma.findingAttachmentBlob.create({
      data: { attachmentId, data: new Uint8Array(data) },
    });
    return '';
  }

  async get(attachmentId: string): Promise<Buffer | null> {
    const blob = await this.prisma.findingAttachmentBlob.findUnique({
      where: { attachmentId },
    });
    return blob ? Buffer.from(blob.data) : null;
  }
}

@Injectable()
export class AttachmentStorageRegistry {
  private readonly drivers: Map<string, AttachmentStorage>;

  constructor(postgres: PostgresAttachmentStorage) {
    this.drivers = new Map([[postgres.driver, postgres]]);
    // Fail at boot, not on the first upload, if the configured driver doesn't exist.
    this.forWrite();
  }

  /** The driver new uploads go to. */
  forWrite(): AttachmentStorage {
    return this.forDriver(process.env.ATTACHMENT_STORAGE_DRIVER || 'postgres');
  }

  /** The driver an existing file was written with. */
  forDriver(driver: string): AttachmentStorage {
    const storage = this.drivers.get(driver);
    if (!storage) {
      throw new Error(
        `Unknown attachment storage driver "${driver}" (available: ${[...this.drivers.keys()].join(', ')})`,
      );
    }
    return storage;
  }
}
