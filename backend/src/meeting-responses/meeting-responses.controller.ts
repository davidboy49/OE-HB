import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MeetingResponsesService } from './meeting-responses.service';
import { UpsertMeetingResponseDto } from './dto/upsert-response.dto';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { LogActivity } from '../common/decorators/log-activity.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Authenticated } from '../common/decorators/authenticated.decorator';

/**
 * Every route requires a login (there is no public access any more). Department scoping
 * is enforced in the service from the caller's registered department, never from the
 * request.
 */
@ApiTags('meeting-responses')
@ApiBearerAuth()
@Controller('meeting-responses')
export class MeetingResponsesController {
  constructor(private readonly service: MeetingResponsesService) {}

  /** Entry point for a scanned Annual Plan QR code. */
  @Authenticated()
  @Get('scan/:token')
  scan(@Param('token') token: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.scan(user.sub, token);
  }

  @Get('rollup')
  @RequirePermission('meeting-responses:view-all')
  rollup(@Query('annualPlanId') annualPlanId?: string) {
    return this.service.rollup(annualPlanId || undefined);
  }

  /** Scoped in the service: your own department's meetings, or all for view-all holders. */
  @Authenticated()
  @Get('meetings/:id')
  meeting(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getMeeting(user.sub, id);
  }

  @Put('meetings/:id/mine')
  @RequirePermission('meeting-responses:create')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'RESPOND_OPEN_MEETING',
    details: `Responded (${req.body.status}) to open meeting ID: ${req.params.id}`,
  }))
  respond(
    @Param('id') id: string,
    @Body() dto: UpsertMeetingResponseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.upsertMine(user.sub, id, dto);
  }
}
