import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AttachmentsService } from './attachments.service';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { LogActivity } from '../common/decorators/log-activity.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@ApiTags('attachments')
@ApiBearerAuth()
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @RequirePermission('attachments:create')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'ADD_ATTACHMENT',
    details: `Added attachment "${req.body.fileName}" to project ID: ${req.body.projectId}`,
  }))
  create(@Body() dto: CreateAttachmentDto) {
    return this.attachmentsService.create(
      dto.projectId,
      dto.fileName,
      dto.fileSize,
      dto.fileType,
      dto.fileData,
    );
  }

  @Delete(':id')
  @RequirePermission('attachments:delete')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'DELETE_ATTACHMENT',
    details: `Deleted attachment ID: ${req.params.id}`,
  }))
  remove(@Param('id') id: string) {
    return this.attachmentsService.remove(id);
  }
}
