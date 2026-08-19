import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MeetingsService } from './meetings.service';
import { CreateOpenMeetingDto } from './dto/create-open-meeting.dto';
import { UpdateOpenMeetingDto } from './dto/update-open-meeting.dto';
import { RecordQrConsentDto } from './dto/record-qr-consent.dto';
import { DepartmentsService } from '../departments/departments.service';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { LogActivity } from '../common/decorators/log-activity.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@ApiTags('meetings')
@ApiBearerAuth()
@Controller('meetings')
export class MeetingsController {
  constructor(
    private readonly meetingsService: MeetingsService,
    private readonly departmentsService: DepartmentsService,
  ) {}

  @Get()
  findAll() {
    return this.meetingsService.findAll();
  }

  @Get('project/:projectId')
  findByProject(@Param('projectId') projectId: string) {
    return this.meetingsService.findByProject(projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.meetingsService.findOne(id);
  }

  @Post()
  @RequirePermission('meetings:create')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'CREATE_OPEN_MEETING',
    details: `Created open meeting for project ID: ${req.body.projectId}`,
  }))
  create(@Body() dto: CreateOpenMeetingDto) {
    return this.meetingsService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('meetings:update')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'UPDATE_OPEN_MEETING',
    details: `Updated open meeting ID: ${req.params.id}`,
  }))
  update(@Param('id') id: string, @Body() dto: UpdateOpenMeetingDto) {
    return this.meetingsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('meetings:delete')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'DELETE_OPEN_MEETING',
    details: `Deleted open meeting ID: ${req.params.id}`,
  }))
  remove(@Param('id') id: string) {
    return this.meetingsService.remove(id);
  }

  /**
   * Mirrors getOpenMeetingByQrAction (actions.ts:823-832). Public: an unauthenticated
   * auditee scanning a physical QR code has no account. Drops `currentUser` from the
   * response entirely - there's no reliable identity for an anonymous public request.
   */
  @Public()
  @Get('qr/:qrToken')
  async findByQrToken(@Param('qrToken') qrToken: string) {
    const schedule = await this.meetingsService.findByQrToken(qrToken);
    const departments = await this.departmentsService.findAll();
    let projectMeetings: any[] = [];
    if (schedule) {
      projectMeetings = await this.meetingsService.findByProject(
        schedule.projectId,
      );
    }
    return { schedule, departments, projectMeetings };
  }

  /**
   * Mirrors recordDepartmentConsentAction (actions.ts:834-848), invoked from the QR scan
   * page (frontend/src/app/meetings/scan/[qrToken]/scan-client.tsx:105-122). The old page
   * first resolved qrToken -> schedule via getOpenMeetingByQrAction, then called
   * recordDepartmentConsentAction(schedule.id, ...) with the resolved id. This route
   * reproduces that in one hop: it re-resolves qrToken to the target schedule/meeting id
   * itself, so the client only ever needs the qrToken it scanned.
   *
   * Public, per the auth-model change: no JWT, so identity is collected directly from the
   * request body (acceptedByUserName/Email) instead of derived from a session, and
   * acceptedByUserId is left empty.
   */
  @Public()
  @Post('qr/:qrToken/consent')
  async recordConsent(
    @Param('qrToken') qrToken: string,
    @Body() dto: RecordQrConsentDto,
  ) {
    const schedule = await this.meetingsService.findByQrToken(qrToken);
    if (!schedule)
      throw new NotFoundException(
        'No meeting or schedule found for this QR code',
      );

    return this.meetingsService.updateDepartmentConsent(
      schedule.id,
      dto.departmentId,
      {
        status: dto.status,
        acceptedByUserId: '',
        acceptedByUserName: dto.acceptedByUserName,
        acceptedByUserEmail: dto.acceptedByUserEmail,
        timestamp: new Date().toISOString(),
        comments: dto.comments || '',
      },
    );
  }
}
