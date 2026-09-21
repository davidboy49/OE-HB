import {
  BadRequestException,
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
import { AnnualPlansService } from './annual-plans.service';
import { CreateAnnualPlanDto } from './dto/create-annual-plan.dto';
import { UpdateAnnualPlanDto } from './dto/update-annual-plan.dto';
import { UpdateAnnualPlanStatusDto } from './dto/update-annual-plan-status.dto';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { LogActivity } from '../common/decorators/log-activity.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { DynamicPermission } from '../common/decorators/dynamic-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AccessScopeService } from '../common/access-scope.service';
import { PermissionsResolverService } from '../common/permissions-resolver.service';
import type { AuthenticatedUser } from '../auth/auth.types';

/** DRAFT/REJECTED -> PENDING_APPROVAL needs submit rights; the approver's decision needs approve rights. */
const STATUS_PERMISSION_BY_TARGET: Record<string, string> = {
  PENDING_APPROVAL: 'annual-plans:submit',
  APPROVED: 'annual-plans:approve',
  REJECTED: 'annual-plans:approve',
};

@ApiTags('annual-plans')
@ApiBearerAuth()
@Controller('annual-plans')
export class AnnualPlansController {
  constructor(
    private readonly annualPlansService: AnnualPlansService,
    private readonly permissionsResolver: PermissionsResolverService,
    private readonly accessScope: AccessScopeService,
  ) {}

  @Get()
  @RequirePermission('annual-plans:view')
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.annualPlansService.findAll(
      await this.accessScope.annualPlans(user.sub),
    );
  }

  @Get('approved-topic-counts')
  @RequirePermission('annual-plans:view')
  async getApprovedTopicCounts(@CurrentUser() user: AuthenticatedUser) {
    return this.annualPlansService.getApprovedTopicCounts(
      await this.accessScope.plannedEngagements(user.sub),
    );
  }

  @Post()
  @RequirePermission('annual-plans:create')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'CREATE_ANNUAL_PLAN',
    details: `Created annual plan "${req.body.planName}"`,
  }))
  create(
    @Body() dto: CreateAnnualPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.annualPlansService.create(
      dto.planName,
      dto.period,
      dto.comment ?? '',
      user.name,
    );
  }

  @Patch(':id')
  @RequirePermission('annual-plans:update')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'UPDATE_ANNUAL_PLAN',
    details: `Updated annual plan ID: ${req.params.id}`,
  }))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAnnualPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible('annualPlan', id, user.sub);
    return this.annualPlansService.update(
      id,
      dto.planName,
      dto.period,
      dto.comment ?? '',
    );
  }

  @Post(':id/rotate-qr')
  @RequirePermission('annual-plans:update')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'ROTATE_ANNUAL_PLAN_QR',
    details: `Reset the QR code of annual plan ID: ${req.params.id}`,
  }))
  async rotateQr(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible('annualPlan', id, user.sub);
    return this.annualPlansService.rotateQrToken(id);
  }

  @Patch(':id/status')
  @DynamicPermission('annual-plans:submit', 'annual-plans:approve')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'UPDATE_ANNUAL_PLAN_STATUS',
    details: `Updated annual plan ID: ${req.params.id} status to ${req.body.status}`,
  }))
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAnnualPlanStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const requiredKey = STATUS_PERMISSION_BY_TARGET[dto.status];
    if (!requiredKey) {
      throw new BadRequestException(`Unknown target status: ${dto.status}`);
    }
    await this.permissionsResolver.requirePermission(user, requiredKey);
    await this.accessScope.assertVisible('annualPlan', id, user.sub);
    return this.annualPlansService.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @RequirePermission('annual-plans:delete')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'DELETE_ANNUAL_PLAN',
    details: `Deleted annual plan ID: ${req.params.id}`,
  }))
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.accessScope.assertVisible('annualPlan', id, user.sub);
    return this.annualPlansService.remove(id);
  }
}
