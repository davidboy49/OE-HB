import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FindingsService } from './findings.service';
import { CreateFindingDto } from './dto/create-finding.dto';
import { UpdateFindingDto } from './dto/update-finding.dto';
import { UpdateFindingStatusDto } from './dto/update-finding-status.dto';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { LogActivity } from '../common/decorators/log-activity.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AccessScopeService } from '../common/access-scope.service';
import type { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('findings')
@ApiBearerAuth()
@Controller('findings')
export class FindingsController {
  constructor(
    private readonly findingsService: FindingsService,
    private readonly accessScope: AccessScopeService,
  ) {}

  @Get()
  @RequirePermission('findings:view')
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.findingsService.findAll(
      await this.accessScope.findings(user.sub),
    );
  }

  @Post()
  @RequirePermission('findings:create')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'CREATE_FINDING',
    details: `Created finding "${req.body.title}" under execution schedule ID: ${req.body.executionScheduleId}`,
  }))
  async create(
    @Body() dto: CreateFindingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible(
      'schedule',
      dto.executionScheduleId,
      user.sub,
    );
    return this.findingsService.create(
      dto.title,
      dto.description,
      dto.severity,
      dto.status,
      dto.recommendation,
      dto.executionScheduleId,
      dto.memberId,
    );
  }

  @Patch(':id')
  @RequirePermission('findings:update')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'UPDATE_FINDING',
    details: `Updated finding ID: ${req.params.id}`,
  }))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFindingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible('finding', id, user.sub);
    return this.findingsService.update(id, dto);
  }

  @Patch(':id/status')
  @RequirePermission('findings:update')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'UPDATE_FINDING_STATUS',
    details: `Updated finding ID: ${req.params.id} status to ${req.body.status}`,
  }))
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFindingStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible('finding', id, user.sub);
    return this.findingsService.updateStatus(id, dto.status);
  }
}
