import {
  Body,
  Controller,
  Delete,
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
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { LogActivity } from '../common/decorators/log-activity.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('execution-schedules')
@ApiBearerAuth()
@Controller('execution-schedules')
export class ExecutionSchedulesController {
  constructor(
    private readonly executionSchedulesService: ExecutionSchedulesService,
  ) {}

  @Get()
  findAll() {
    return this.executionSchedulesService.findAll();
  }

  @Post()
  @RequirePermission('execution-schedules:create')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'CREATE_SCHEDULE',
    details: `Created execution schedule for project ID: ${req.body.projectId}`,
  }))
  create(@Body() dto: CreateExecutionScheduleDto) {
    return this.executionSchedulesService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
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
  ) {
    const oldSchedule = await this.executionSchedulesService.findOne(id);
    const result = await this.executionSchedulesService.update(id, dto);

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
  remove(@Param('id') id: string) {
    return this.executionSchedulesService.remove(id);
  }

  /** Public: an unauthenticated auditee scanning a physical QR code has no account. */
  @Public()
  @Get('qr/:qrToken')
  findByQrToken(@Param('qrToken') qrToken: string) {
    return this.executionSchedulesService.findByQrToken(qrToken);
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
  recordConsent(
    @Param('id') id: string,
    @Param('departmentId') departmentId: string,
    @Body() dto: RecordConsentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
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
}
