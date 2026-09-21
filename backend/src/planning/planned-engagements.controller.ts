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
import { PlannedEngagementsService } from './planned-engagements.service';
import { CreatePlannedEngagementDto } from './dto/create-planned-engagement.dto';
import { UpdatePlannedEngagementDto } from './dto/update-planned-engagement.dto';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { LogActivity } from '../common/decorators/log-activity.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@ApiTags('planned-engagements')
@ApiBearerAuth()
@Controller('planned-engagements')
export class PlannedEngagementsController {
  constructor(private readonly plannedEngagementsService: PlannedEngagementsService) {}

  @Get()
  findAll() {
    return this.plannedEngagementsService.findAll();
  }

  @Get('by-annual-plan/:annualPlanId')
  findByAnnualPlan(@Param('annualPlanId') annualPlanId: string) {
    return this.plannedEngagementsService.findByAnnualPlan(annualPlanId);
  }

  @Post()
  @RequirePermission('planned-engagements:create')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'CREATE_PLANNED_ENGAGEMENT',
    details: `Created OE Plan "${req.body.topic}" (No: ${req.body.no})`,
  }))
  create(@Body() dto: CreatePlannedEngagementDto) {
    return this.plannedEngagementsService.create(
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
  @RequirePermission('planned-engagements:update')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'UPDATE_PLANNED_ENGAGEMENT',
    details: `Updated OE Plan ID: ${req.params.id}`,
  }))
  update(@Param('id') id: string, @Body() dto: UpdatePlannedEngagementDto) {
    return this.plannedEngagementsService.update(
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
  @RequirePermission('planned-engagements:delete')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'DELETE_PLANNED_ENGAGEMENT',
    details: `Deleted OE Plan ID: ${req.params.id}`,
  }))
  remove(@Param('id') id: string) {
    return this.plannedEngagementsService.remove(id);
  }
}
