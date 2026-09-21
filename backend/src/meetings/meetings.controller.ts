import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MeetingsService } from './meetings.service';
import { CreateOpenMeetingDto } from './dto/create-open-meeting.dto';
import { UpdateOpenMeetingDto } from './dto/update-open-meeting.dto';
import { UpdateOpenMeetingStatusDto } from './dto/update-open-meeting-status.dto';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { LogActivity } from '../common/decorators/log-activity.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { DynamicPermission } from '../common/decorators/dynamic-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PermissionsResolverService } from '../common/permissions-resolver.service';
import { AccessScopeService } from '../common/access-scope.service';
import type { AuthenticatedUser } from '../auth/auth.types';

/** DRAFT -> SUBMITTED_FOR_APPROVAL needs submit rights; the approver's decision (approve/reject/reopen) needs approve rights. */
const STATUS_PERMISSION_BY_TARGET: Record<string, string> = {
  SUBMITTED_FOR_APPROVAL: 'meetings:submit',
  RELEASED: 'meetings:approve',
  DRAFT: 'meetings:approve',
};

@ApiTags('meetings')
@ApiBearerAuth()
@Controller('meetings')
export class MeetingsController {
  constructor(
    private readonly meetingsService: MeetingsService,
    private readonly permissionsResolver: PermissionsResolverService,
    private readonly accessScope: AccessScopeService,
  ) {}

  @Get()
  @RequirePermission('meetings:view')
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.meetingsService.findAll(
      await this.accessScope.meetings(user.sub),
    );
  }

  @Get('project/:projectId')
  @RequirePermission('meetings:view')
  async findByProject(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.meetingsService.findByProject(
      projectId,
      await this.accessScope.meetings(user.sub),
    );
  }

  @Get(':id')
  @RequirePermission('meetings:view')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible('meeting', id, user.sub);
    return this.meetingsService.findOne(id);
  }

  @Post()
  @RequirePermission('meetings:create')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'CREATE_OPEN_MEETING',
    details: `Created open meeting for project ID: ${req.body.projectId}`,
  }))
  async create(
    @Body() dto: CreateOpenMeetingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible('oePlan', dto.projectId, user.sub);
    return this.meetingsService.create(dto, user.name);
  }

  @Patch(':id')
  @RequirePermission('meetings:update')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'UPDATE_OPEN_MEETING',
    details: `Updated open meeting ID: ${req.params.id}`,
  }))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOpenMeetingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible('meeting', id, user.sub);
    return this.meetingsService.update(id, dto, user.name);
  }

  @Patch(':id/status')
  @DynamicPermission('meetings:submit', 'meetings:approve')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'UPDATE_OPEN_MEETING_STATUS',
    details: `Updated open meeting ID: ${req.params.id} status to ${req.body.status}`,
  }))
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOpenMeetingStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const requiredKey = STATUS_PERMISSION_BY_TARGET[dto.status];
    if (!requiredKey) {
      throw new BadRequestException(`Unknown target status: ${dto.status}`);
    }
    await this.permissionsResolver.requirePermission(user, requiredKey);
    await this.accessScope.assertVisible('meeting', id, user.sub);
    return this.meetingsService.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @RequirePermission('meetings:delete')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'DELETE_OPEN_MEETING',
    details: `Deleted open meeting ID: ${req.params.id}`,
  }))
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible('meeting', id, user.sub);
    return this.meetingsService.remove(id);
  }
}
