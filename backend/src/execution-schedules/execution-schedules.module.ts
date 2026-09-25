import { Module } from '@nestjs/common';
import { ExecutionSchedulesService } from './execution-schedules.service';
import { ExecutionSchedulesController } from './execution-schedules.controller';
import { FindingAttachmentsController } from './attachments/finding-attachments.controller';
import { FindingAttachmentsService } from './attachments/finding-attachments.service';
import {
  AttachmentStorageRegistry,
  PostgresAttachmentStorage,
} from './attachments/attachment-storage';

@Module({
  controllers: [ExecutionSchedulesController, FindingAttachmentsController],
  providers: [
    ExecutionSchedulesService,
    FindingAttachmentsService,
    PostgresAttachmentStorage,
    AttachmentStorageRegistry,
  ],
  exports: [ExecutionSchedulesService],
})
export class ExecutionSchedulesModule {}
