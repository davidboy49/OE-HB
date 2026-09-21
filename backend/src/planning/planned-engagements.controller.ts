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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AccessScopeService } from '../common/access-scope.service';
import type { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('planned-engagements')
@ApiBearerAuth()
@Controller('planned-engagements')
export class PlannedEngagementsController {
  constructor(
    private readonly plannedEngagementsService: PlannedEngagementsService,
    private readonly accessScope: AccessScopeService,
  ) {}

  @Get()
  @RequirePermission('planned-engagements:view')
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.plannedEngagementsService.findAll(
      await this.accessScope.plannedEngagements(user.sub),
    );
  }

  @Get('by-annual-plan/:annualPlanId')
  @RequirePermission('planned-engagements:view')
  async findByAnnualPlan(
    @Param('annualPlanId') annualPlanId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.plannedEngagementsService.findByAnnualPlan(
      annualPlanId,
      await this.accessScope.plannedEngagements(user.sub),
    );
  }

  @Post()
  @RequirePermission('planned-engagements:create')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'CREATE_PLANNED_ENGAGEMENT',
    details: `Created OE Plan "${req.body.topic}" (No: ${req.body.no})`,
  }))
  async create(
    @Body() dto: CreatePlannedEngagementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible(
      'annualPlan',
      dto.annualPlanId,
      user.sub,
    );
    await this.accessScope.assertDepartmentInScope(dto.departmentId, user.sub);
    return this.plannedEngagementsService.create(
      dto.annualPlanId,
      dto.no,
      dto.projectName,
      dto.departmentId,
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
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePlannedEngagementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible('plannedEngagement', id, user.sub);
    await this.accessScope.assertDepartmentInScope(dto.departmentId, user.sub);
    return this.plannedEngagementsService.update(
      id,
      dto.projectName,
      dto.departmentId,
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
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible('plannedEngagement', id, user.sub);
    return this.plannedEngagementsService.remove(id);
  }
}
