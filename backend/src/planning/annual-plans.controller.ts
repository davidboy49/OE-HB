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
import { CurrentUser } from '../common/decorators/current-user.decorator';
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
  ) {}

  @Get()
  findAll() {
    return this.annualPlansService.findAll();
  }

  @Get('approved-topic-counts')
  getApprovedTopicCounts() {
    return this.annualPlansService.getApprovedTopicCounts();
  }

  @Post()
  @RequirePermission('annual-plans:create')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'CREATE_ANNUAL_PLAN',
    details: `Created annual plan "${req.body.planName}"`,
  }))
  create(@Body() dto: CreateAnnualPlanDto) {
    return this.annualPlansService.create(
      dto.planName,
      dto.period,
      dto.comment ?? '',
    );
  }

  @Patch(':id')
  @RequirePermission('annual-plans:update')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'UPDATE_ANNUAL_PLAN',
    details: `Updated annual plan ID: ${req.params.id}`,
  }))
  update(@Param('id') id: string, @Body() dto: UpdateAnnualPlanDto) {
    return this.annualPlansService.update(
      id,
      dto.planName,
      dto.period,
      dto.comment ?? '',
    );
  }

  @Patch(':id/status')
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
    return this.annualPlansService.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @RequirePermission('annual-plans:delete')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'DELETE_ANNUAL_PLAN',
    details: `Deleted annual plan ID: ${req.params.id}`,
  }))
  remove(@Param('id') id: string) {
    return this.annualPlansService.remove(id);
  }
}
