import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ActivityLogInterceptor } from '../../common/interceptors/activity-log.interceptor';
import { LogActivity } from '../../common/decorators/log-activity.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DynamicPermission } from '../../common/decorators/dynamic-permission.decorator';
import { AccessScopeService } from '../../common/access-scope.service';
import { PermissionsResolverService } from '../../common/permissions-resolver.service';
import type { AuthenticatedUser } from '../../auth/auth.types';
import {
  FINDING_ATTACHMENT_MAX_BYTES,
  FindingAttachmentsService,
  type UploadedFile as UploadedFileData,
} from './finding-attachments.service';

/**
 * Finding row attachments, one file per request (multipart field "file", max 25 MB). Adding or
 * removing a file needs execution-schedules:update (report editor) or
 * execution-schedules:resolve-finding (resolver - existing rows only, same as the resolve
 * route). Downloading follows the report's own view scope.
 */
@ApiTags('execution-schedules')
@ApiBearerAuth()
@Controller('execution-schedules')
export class FindingAttachmentsController {
  constructor(
    private readonly attachments: FindingAttachmentsService,
    private readonly permissionsResolver: PermissionsResolverService,
    private readonly accessScope: AccessScopeService,
  ) {}

  @Post(':id/finding-rows/:rowId/attachments')
  @DynamicPermission(
    'execution-schedules:update',
    'execution-schedules:resolve-finding',
  )
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: FINDING_ATTACHMENT_MAX_BYTES },
    }),
    ActivityLogInterceptor,
  )
  @LogActivity((req) => ({
    action: 'UPLOAD_FINDING_ATTACHMENT',
    details: `Uploaded an attachment to finding row ${String(req.params.rowId)} on schedule ID: ${String(req.params.id)}`,
  }))
  async upload(
    @Param('id') id: string,
    @Param('rowId') rowId: string,
    @UploadedFile() file: UploadedFileData | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const isEditor = await this.requireEditOrResolve(user);
    await this.accessScope.assertVisible('schedule', id, user.sub);
    return this.attachments.upload(id, rowId, file, user.name, !isEditor);
  }

  @Get(':id/attachments/:attachmentId')
  @RequirePermission('execution-schedules:view')
  async download(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StreamableFile> {
    await this.accessScope.assertVisible('schedule', id, user.sub);
    const { meta, data } = await this.attachments.download(id, attachmentId);
    const asciiName = meta.name
      .replace(/[^\x20-\x7e]/g, '_')
      .replace(/"/g, "'");
    return new StreamableFile(data, {
      type: meta.type,
      length: data.length,
      disposition: `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
    });
  }

  @Delete(':id/attachments/:attachmentId')
  @DynamicPermission(
    'execution-schedules:update',
    'execution-schedules:resolve-finding',
  )
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'DELETE_FINDING_ATTACHMENT',
    details: `Removed attachment ${String(req.params.attachmentId)} from schedule ID: ${String(req.params.id)}`,
  }))
  async remove(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const isEditor = await this.requireEditOrResolve(user);
    await this.accessScope.assertVisible('schedule', id, user.sub);
    await this.attachments.remove(id, attachmentId, !isEditor);
    return true;
  }

  /** Returns true for a report editor, false for a resolve-only caller; throws for neither. */
  private async requireEditOrResolve(
    user: AuthenticatedUser,
  ): Promise<boolean> {
    const granted = await this.permissionsResolver.getEffectivePermissions(
      user.sub,
    );
    if (granted.includes('execution-schedules:update')) return true;
    if (granted.includes('execution-schedules:resolve-finding')) return false;
    throw new ForbiddenException('Access Denied');
  }
}
