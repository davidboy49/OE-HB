import {
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
import { AuditPlansService } from './audit-plans.service';
import { CreateAuditPlanDto } from './dto/create-audit-plan.dto';
import { UpdateAuditPlanDto } from './dto/update-audit-plan.dto';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { LogActivity } from '../common/decorators/log-activity.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@ApiTags('audit-plans')
@ApiBearerAuth()
@Controller('audit-plans')
export class AuditPlansController {
  constructor(private readonly auditPlansService: AuditPlansService) {}

  @Get()
  findAll() {
    return this.auditPlansService.findAll();
  }

  @Get('by-annual-plan/:annualPlanId')
  findByAnnualPlan(@Param('annualPlanId') annualPlanId: string) {
    return this.auditPlansService.findByAnnualPlan(annualPlanId);
  }

  @Post()
  @RequirePermission('audit-plans:create')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'CREATE_AUDIT_PLAN',
    details: `Created Audit Plan "${req.body.topic}" (No: ${req.body.no})`,
  }))
  create(@Body() dto: CreateAuditPlanDto) {
    return this.auditPlansService.create(
      dto.annualPlanId,
      dto.no,
      dto.projectName,
      dto.topic,
      dto.bu,
      dto.type ?? 'OE',
      dto.revieweeIds,
      new Date(dto.conductDate),
      new Date(dto.endDate),
      dto.durationDay,
      dto.purpose,
      dto.objectives ?? '',
      dto.scope ?? '',
    );
  }

  @Patch(':id')
  @RequirePermission('audit-plans:update')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'UPDATE_AUDIT_PLAN',
    details: `Updated Audit Plan ID: ${req.params.id}`,
  }))
  update(@Param('id') id: string, @Body() dto: UpdateAuditPlanDto) {
    return this.auditPlansService.update(
      id,
      dto.projectName,
      dto.topic,
      dto.bu,
      dto.type,
      dto.revieweeIds,
      new Date(dto.conductDate),
      new Date(dto.endDate),
      dto.durationDay,
      dto.purpose,
      dto.objectives ?? '',
      dto.scope ?? '',
    );
  }

  @Delete(':id')
  @RequirePermission('audit-plans:delete')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'DELETE_AUDIT_PLAN',
    details: `Deleted Audit Plan ID: ${req.params.id}`,
  }))
  remove(@Param('id') id: string) {
    return this.auditPlansService.remove(id);
  }
}
