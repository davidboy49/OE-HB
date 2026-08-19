import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditProjectsService } from './audit-projects.service';
import { CreateAuditProjectDto } from './dto/create-audit-project.dto';
import { UpdateAuditProjectDto } from './dto/update-audit-project.dto';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { LogActivity } from '../common/decorators/log-activity.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@ApiTags('audit-projects')
@ApiBearerAuth()
@Controller('audit-projects')
export class AuditProjectsController {
  constructor(private readonly auditProjectsService: AuditProjectsService) {}

  @Get()
  findAll() {
    return this.auditProjectsService.findAll();
  }

  /** Mirrors getNextDocumentCodeAction - a pure read, not logged in the original either. */
  @Get('next-code')
  getNextCode(@Query('prefix') prefix?: string, @Query('year') year?: string) {
    return this.auditProjectsService.getNextCodePreview(
      prefix,
      year ? Number(year) : undefined,
    );
  }

  @Post()
  @RequirePermission('audit-projects:create')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req, result) => ({
    action: 'CREATE_PROJECT',
    details: `Created project "${req.body.name}" (Code: ${result.code})`,
  }))
  create(@Body() dto: CreateAuditProjectDto) {
    return this.auditProjectsService.create(
      dto.name,
      dto.code ?? 'AUTO',
      dto.status,
      dto.scope,
      dto.planningDetails,
      dto.startDate,
      dto.endDate,
      dto.leadAuditorId ?? null,
      dto.departments ?? '',
      dto.annualPlanId ?? null,
      dto.auditPlanId ?? null,
    );
  }

  @Patch(':id')
  @RequirePermission('audit-projects:update')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'UPDATE_PROJECT',
    details: `Updated project ID: ${req.params.id}`,
  }))
  update(@Param('id') id: string, @Body() dto: UpdateAuditProjectDto) {
    return this.auditProjectsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('audit-projects:delete')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'DELETE_PROJECT',
    details: `Deleted project ID: ${req.params.id}`,
  }))
  remove(@Param('id') id: string) {
    return this.auditProjectsService.remove(id);
  }
}
