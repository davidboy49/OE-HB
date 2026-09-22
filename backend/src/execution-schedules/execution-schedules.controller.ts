import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ExecutionSchedulesService } from './execution-schedules.service';
import { CreateExecutionScheduleDto } from './dto/create-execution-schedule.dto';
import { UpdateExecutionScheduleDto } from './dto/update-execution-schedule.dto';
import { RecordConsentDto } from './dto/record-consent.dto';
import { ConfirmAttendeeDto } from './dto/confirm-attendee.dto';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { LogActivity } from '../common/decorators/log-activity.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AccessScopeService } from '../common/access-scope.service';
import type { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('execution-schedules')
@ApiBearerAuth()
@Controller('execution-schedules')
export class ExecutionSchedulesController {
  constructor(
    private readonly executionSchedulesService: ExecutionSchedulesService,
    private readonly accessScope: AccessScopeService,
  ) {}

  @Get()
  @RequirePermission('execution-schedules:view')
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.executionSchedulesService.findAll(
      await this.accessScope.schedules(user.sub),
    );
  }

  @Post()
  @RequirePermission('execution-schedules:create')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'CREATE_SCHEDULE',
    details: `Created execution schedule for project ID: ${req.body.projectId}`,
  }))
  async create(
    @Body() dto: CreateExecutionScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible('oePlan', dto.projectId, user.sub);
    return this.executionSchedulesService.create(dto, user.name);
  }

  @Get(':id')
  @RequirePermission('execution-schedules:view')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible('schedule', id, user.sub);
    return this.executionSchedulesService.findOne(id);
  }

  /**
   * Mirrors updateExecutionScheduleAction's ADD/DELETE_SCHEDULE_SLOT diffing
   * (actions.ts:326-373). The @LogActivity meta callback is synchronous and only sees
   * req/result, so it can't itself re-fetch the pre-update row; instead this handler
   * fetches the old schedule, computes the diff, and stashes it on `req` (same object
   * instance the interceptor reads via `tap` after this method resolves) so the meta
   * callback can stay declarative.
   */
  @Patch(':id')
  @RequirePermission('execution-schedules:update')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => {
    const meta = (req as any).scheduleUpdateActivityMeta;
    return (
      meta ?? {
        action: 'UPDATE_SCHEDULE',
        details: `Updated execution schedule ID: ${req.params.id}`,
      }
    );
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateExecutionScheduleDto,
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible('schedule', id, user.sub);
    const oldSchedule = await this.executionSchedulesService.findOne(id);
    const result = await this.executionSchedulesService.update(
      id,
      dto,
      user.name,
    );

    let action = 'UPDATE_SCHEDULE';
    let details = `Updated execution schedule ID: ${id}`;
    if (oldSchedule && dto.scheduleRows) {
      try {
        const oldRows = JSON.parse(oldSchedule.scheduleRows || '[]');
        const newRows = JSON.parse(dto.scheduleRows || '[]');
        if (newRows.length > oldRows.length) {
          action = 'ADD_SCHEDULE_SLOT';
          details = `Added ${newRows.length - oldRows.length} slot(s) to schedule ID: ${id} (Total slots: ${newRows.length})`;
        } else if (newRows.length < oldRows.length) {
          action = 'DELETE_SCHEDULE_SLOT';
          details = `Deleted ${oldRows.length - newRows.length} slot(s) from schedule ID: ${id} (Total slots: ${newRows.length})`;
        }
      } catch {
        // JSON parse fallback - keep generic UPDATE_SCHEDULE message
      }
    }
    (req as any).scheduleUpdateActivityMeta = { action, details };

    return result;
  }

  @Delete(':id')
  @RequirePermission('execution-schedules:delete')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'DELETE_SCHEDULE',
    details: `Deleted execution schedule ID: ${req.params.id}`,
  }))
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible('schedule', id, user.sub);
    return this.executionSchedulesService.remove(id);
  }

  /**
   * Authenticated department-consent route (e.g. recording consent from within the
   * dashboard, as opposed to the public QR scan flow on MeetingsController). Identity
   * comes from the JWT rather than from the request body.
   */
  @Patch(':id/consent/:departmentId')
  @RequirePermission('execution-schedules:update')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'RECORD_DEPARTMENT_CONSENT',
    details: `User ${(req as any).user?.name} (${req.params.departmentId}) recorded consent status: ${req.body.status} for schedule ${req.params.id}`,
  }))
  async recordConsent(
    @Param('id') id: string,
    @Param('departmentId') departmentId: string,
    @Body() dto: RecordConsentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible('schedule', id, user.sub);
    return this.executionSchedulesService.updateDepartmentConsent(
      id,
      departmentId,
      {
        status: dto.status,
        acceptedByUserId: user.sub,
        acceptedByUserName: user.name,
        acceptedByUserEmail: user.email,
        timestamp: new Date().toISOString(),
        comments: dto.comments || '',
      },
    );
  }

  /**
   * Records that one attendee confirmed attendance - a single atomic write to just that key
   * (see ExecutionSchedulesService.confirmAttendee), unlike the generic PATCH above which
   * replaces the whole record and would silently drop a concurrent confirmation from someone
   * else. Same permission as the generic edit route, plus: you may only confirm your own
   * attendance unless you're an ADMIN (previously only enforced in the UI).
   */
  @Patch(':id/attendee-confirmation')
  @RequirePermission('execution-schedules:update')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'CONFIRM_ATTENDEE',
    details: `${req.body.attendeeName} confirmed attendance on schedule ID: ${req.params.id}`,
  }))
  async confirmAttendee(
    @Param('id') id: string,
    @Body() dto: ConfirmAttendeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible('schedule', id, user.sub);
    if (
      user.role !== 'ADMIN' &&
      dto.attendeeName.trim().toLowerCase() !== user.name.trim().toLowerCase()
    ) {
      throw new ForbiddenException(
        'Only the attendee or an Admin can confirm this attendance.',
      );
    }
    return this.executionSchedulesService.confirmAttendee(
      id,
      dto.attendeeName,
      user.name,
    );
  }
}
