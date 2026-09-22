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
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { LogActivity } from '../common/decorators/log-activity.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AccessScopeService } from '../common/access-scope.service';
import type { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('projects')
@ApiBearerAuth()
// "planned-engagements" is kept as an alias so the mobile app's existing integration keeps
// working unchanged; all new code should call /projects.
@Controller(['projects', 'planned-engagements'])
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly accessScope: AccessScopeService,
  ) {}

  @Get()
  @RequirePermission('projects:view')
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.findAll(
      await this.accessScope.projects(user.sub),
    );
  }

  @Get('by-annual-plan/:annualPlanId')
  @RequirePermission('projects:view')
  async findByAnnualPlan(
    @Param('annualPlanId') annualPlanId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.findByAnnualPlan(
      annualPlanId,
      await this.accessScope.projects(user.sub),
    );
  }

  @Post()
  @RequirePermission('projects:create')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'CREATE_PROJECT',
    details: `Created Project "${req.body.projectName}" (No: ${req.body.no})`,
  }))
  async create(
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible(
      'annualPlan',
      dto.annualPlanId,
      user.sub,
    );
    await this.accessScope.assertDepartmentInScope(dto.departmentId, user.sub);
    return this.projectsService.create(
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
  @RequirePermission('projects:update')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'UPDATE_PROJECT',
    details: `Updated Project ID: ${req.params.id}`,
  }))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible('project', id, user.sub);
    await this.accessScope.assertDepartmentInScope(dto.departmentId, user.sub);
    return this.projectsService.update(
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
  @RequirePermission('projects:delete')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'DELETE_PROJECT',
    details: `Deleted Project ID: ${req.params.id}`,
  }))
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible('project', id, user.sub);
    return this.projectsService.remove(id);
  }
}
