/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  FINDING_ATTACHMENT_MAX_BYTES,
  FindingAttachmentsService,
} from './finding-attachments.service';
import { ExecutionSchedulesService } from '../execution-schedules.service';
import type { AttachmentStorageRegistry } from './attachment-storage';
import type { PrismaService } from '../../prisma/prisma.service';
import type { PlanItemsService } from '../../common/plan-items.service';

const file = (size = 3) => ({
  originalname: 'photo.jpg',
  mimetype: 'image/jpeg',
  size,
  buffer: Buffer.alloc(size),
});

function makeAttachments(schedule: Record<string, unknown> | null) {
  const put = jest.fn().mockResolvedValue('');
  const prisma = {
    executionSchedule: {
      findUnique: jest.fn().mockResolvedValue(schedule),
    },
    findingAttachment: {
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: 'a1', ...data }),
        ),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
    },
  } as unknown as PrismaService;
  const registry = {
    forWrite: () => ({ driver: 'postgres', put }),
    forDriver: jest.fn(),
  } as unknown as AttachmentStorageRegistry;
  return {
    service: new FindingAttachmentsService(prisma, registry),
    prisma,
    put,
  };
}

const findingReport = {
  isDeleted: false,
  language: 'finding',
  scheduleRows: JSON.stringify([{ id: 'r1' }]),
};

describe('FindingAttachmentsService.upload', () => {
  it('stores metadata and hands the bytes to the storage driver', async () => {
    const { service, prisma, put } = makeAttachments(findingReport);

    const meta = await service.upload('s1', 'r1', file(), 'Dara', true);

    expect(meta).toEqual({
      id: 'a1',
      name: 'photo.jpg',
      size: 3,
      type: 'image/jpeg',
    });
    expect(prisma.findingAttachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scheduleId: 's1',
        rowId: 'r1',
        storage: 'postgres',
        uploadedBy: 'Dara',
      }),
    });
    expect(put).toHaveBeenCalledWith('a1', expect.any(Buffer));
  });

  it('rejects files over 25 MB', async () => {
    const { service } = makeAttachments(findingReport);

    await expect(
      service.upload(
        's1',
        'r1',
        file(FINDING_ATTACHMENT_MAX_BYTES + 1),
        'Dara',
        false,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('only allows attachments on findings reports', async () => {
    const { service } = makeAttachments({
      ...findingReport,
      language: 'English',
    });

    await expect(
      service.upload('s1', 'r1', file(), 'Dara', false),
    ).rejects.toThrow(BadRequestException);
  });

  it('lets an editor attach to a row still being drafted, but not a resolve-only caller', async () => {
    const editor = makeAttachments(findingReport);
    await editor.service.upload('s1', 'new-row', file(), 'Dara', false);
    expect(editor.put).toHaveBeenCalled();

    const resolver = makeAttachments(findingReport);
    await expect(
      resolver.service.upload('s1', 'new-row', file(), 'Dara', true),
    ).rejects.toThrow(NotFoundException);
    expect(resolver.put).not.toHaveBeenCalled();
  });

  it('removes the metadata again if the bytes could not be stored', async () => {
    const { service, prisma, put } = makeAttachments(findingReport);
    put.mockRejectedValueOnce(new Error('disk full'));

    await expect(
      service.upload('s1', 'r1', file(), 'Dara', false),
    ).rejects.toThrow('disk full');
    expect(prisma.findingAttachment.delete).toHaveBeenCalledWith({
      where: { id: 'a1' },
    });
  });
});

describe('ExecutionSchedulesService + attachments', () => {
  function makeSchedules(oldRows: unknown[]) {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(1),
      executionSchedule: {
        findUnique: jest.fn().mockResolvedValue({
          id: 's1',
          isDeleted: false,
          language: 'finding',
          scheduleRows: JSON.stringify(oldRows),
        }),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 's1',
            oePlanId: 'p1',
            oePlan: { name: 'x', code: 'OEP-1' },
            language: 'finding',
            scheduleRows: data.scheduleRows,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
      },
    } as unknown as PrismaService;
    const planItems = {
      writeList: jest.fn().mockResolvedValue(undefined),
      readOne: jest.fn().mockResolvedValue('[]'),
      readMany: jest.fn().mockResolvedValue(new Map()),
    } as unknown as PlanItemsService;
    const attachments = {
      metaBySchedule: jest.fn().mockResolvedValue(
        new Map([
          [
            's1',
            new Map([
              [
                'r1',
                [
                  {
                    id: 'a1',
                    name: 'f.pdf',
                    size: 1,
                    type: 'application/pdf',
                  },
                ],
              ],
            ]),
          ],
        ]),
      ),
      removeForRows: jest.fn().mockResolvedValue(undefined),
    } as unknown as FindingAttachmentsService;
    return {
      service: new ExecutionSchedulesService(prisma, planItems, attachments),
      prisma,
      attachments,
    };
  }

  it('never stores a client-sent attachments list, and returns the real one from the table', async () => {
    const { service, prisma } = makeSchedules([{ id: 'r1' }]);

    const result = await service.update(
      's1',
      {
        scheduleRows: JSON.stringify([
          { id: 'r1', attachments: [{ id: 'fake', data: 'data:...' }] },
        ]),
      },
      'Dara',
    );

    const stored = JSON.parse(
      (prisma.executionSchedule.update as jest.Mock).mock.calls[0][0].data
        .scheduleRows,
    );
    expect(stored[0].attachments).toBeUndefined();
    expect(JSON.parse(result.scheduleRows)[0].attachments).toEqual([
      { id: 'a1', name: 'f.pdf', size: 1, type: 'application/pdf' },
    ]);
  });

  it('soft-deletes the files of finding rows the save removed', async () => {
    const { service, attachments } = makeSchedules([
      { id: 'r1' },
      { id: 'r2' },
    ]);

    await service.update(
      's1',
      { scheduleRows: JSON.stringify([{ id: 'r1' }]) },
      'Dara',
    );

    expect(attachments.removeForRows).toHaveBeenCalledWith('s1', ['r2']);
  });
});
