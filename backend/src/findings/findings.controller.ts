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

@ApiTags('findings')
@ApiBearerAuth()
@Controller('findings')
export class FindingsController {
  constructor(private readonly findingsService: FindingsService) {}

  @Get()
  findAll() {
    return this.findingsService.findAll();
  }

  @Post()
  @RequirePermission('findings:create')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'CREATE_FINDING',
    details: `Created finding "${req.body.title}" under execution schedule ID: ${req.body.executionScheduleId}`,
  }))
  create(@Body() dto: CreateFindingDto) {
    return this.findingsService.create(
      dto.title,
      dto.description,
      dto.severity,
      dto.status,
      dto.recommendation,
      dto.executionScheduleId,
      dto.auditorId,
    );
  }

  @Patch(':id')
  @RequirePermission('findings:update')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'UPDATE_FINDING',
    details: `Updated finding ID: ${req.params.id}`,
  }))
  update(@Param('id') id: string, @Body() dto: UpdateFindingDto) {
    return this.findingsService.update(id, dto);
  }

  @Patch(':id/status')
  @RequirePermission('findings:update')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'UPDATE_FINDING_STATUS',
    details: `Updated finding ID: ${req.params.id} status to ${req.body.status}`,
  }))
  updateStatus(@Param('id') id: string, @Body() dto: UpdateFindingStatusDto) {
    return this.findingsService.updateStatus(id, dto.status);
  }
}
