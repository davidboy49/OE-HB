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
import { OePlansService } from './oe-plans.service';
import { CreateOePlanDto } from './dto/create-oe-plan.dto';
import { UpdateOePlanDto } from './dto/update-oe-plan.dto';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { LogActivity } from '../common/decorators/log-activity.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { DynamicPermission } from '../common/decorators/dynamic-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AccessScopeService } from '../common/access-scope.service';
import type { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('oe-plans')
@ApiBearerAuth()
@Controller('oe-plans')
export class OePlansController {
  constructor(
    private readonly oePlansService: OePlansService,
    private readonly accessScope: AccessScopeService,
  ) {}

  @Get()
  @RequirePermission('oe-plans:view')
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.oePlansService.findAll(
      await this.accessScope.oePlanReadScope(user.sub),
    );
  }

  @Post()
  @RequirePermission('oe-plans:create')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req, result) => ({
    action: 'CREATE_PROJECT',
    details: `Created project "${req.body.name}" (Code: ${result.code})`,
  }))
  async create(
    @Body() dto: CreateOePlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible(
      'plannedEngagement',
      dto.plannedEngagementId,
      user.sub,
    );
    return this.oePlansService.create(
      dto.name,
      dto.code ?? 'AUTO',
      dto.status,
      dto.scope,
      dto.planningDetails,
      dto.startDate,
      dto.endDate,
      dto.leaderId ?? null,
      dto.departments ?? '',
      dto.annualPlanId ?? null,
      dto.plannedEngagementId ?? null,
      user.name,
    );
  }

  /**
   * No blanket @RequirePermission here - this single endpoint handles both
   * plain field edits and status transitions (submit/approve/close/reopen),
   * each needing a different permission. assertUpdateAllowed resolves which
   * one applies and throws ForbiddenException if the caller lacks it.
   */
  @Patch(':id')
  @DynamicPermission(
    'oe-plans:update',
    'oe-plans:submit',
    'oe-plans:approve',
    'oe-plans:close',
    'oe-plans:reopen',
  )
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'UPDATE_PROJECT',
    details: `Updated project ID: ${req.params.id}`,
  }))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOePlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible('oePlan', id, user.sub);
    await this.oePlansService.assertUpdateAllowed(id, dto, user);
    return this.oePlansService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('oe-plans:delete')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'DELETE_PROJECT',
    details: `Deleted project ID: ${req.params.id}`,
  }))
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible('oePlan', id, user.sub);
    return this.oePlansService.remove(id);
  }
}
