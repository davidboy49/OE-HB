import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  BadRequestException,
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

  @Get('page')
  @RequirePermission('oe-plans:view')
  async findPage(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') pageValue = '1',
    @Query('pageSize') pageSizeValue = '10',
    @Query('search') search = '',
    @Query('status') status = 'ALL',
  ) {
    const page = Number(pageValue);
    const pageSize = Number(pageSizeValue);
    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('page must be a positive integer');
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new BadRequestException('pageSize must be an integer between 1 and 100');
    }
    const allowedStatuses = [
      'ALL',
      'PLANNING',
      'SUBMITTED_FOR_APPROVAL',
      'RELEASED',
      'CLOSED',
    ];
    if (!allowedStatuses.includes(status)) {
      throw new BadRequestException('status is not valid');
    }

    return this.oePlansService.findPage(
      await this.accessScope.oePlanReadScope(user.sub),
      { page, pageSize, search: search.trim(), status },
    );
  }

  @Post()
  @RequirePermission('oe-plans:create')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req, result) => ({
    action: 'CREATE_OE_PLAN',
    details: `Created Individual OE Plan "${req.body.name}" (Code: ${result.code})`,
  }))
  async create(
    @Body() dto: CreateOePlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible('project', dto.projectId, user.sub);
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
      dto.projectId ?? null,
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
    action: 'UPDATE_OE_PLAN',
    details: `Updated Individual OE Plan ID: ${req.params.id}`,
  }))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOePlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible('oePlan', id, user.sub);
    await this.oePlansService.assertUpdateAllowed(id, dto, user);
    return this.oePlansService.update(id, dto, user.name);
  }

  @Delete(':id')
  @RequirePermission('oe-plans:delete')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'DELETE_OE_PLAN',
    details: `Deleted Individual OE Plan ID: ${req.params.id}`,
  }))
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible('oePlan', id, user.sub);
    return this.oePlansService.remove(id);
  }
}
