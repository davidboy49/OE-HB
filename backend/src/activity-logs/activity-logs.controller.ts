import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActivityLogsService } from './activity-logs.service';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('activity-logs')
@ApiBearerAuth()
@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  @RequirePermission('activity-logs:view')
  findAll() {
    return this.activityLogsService.findAll();
  }

  @Post()
  @RequirePermission('activity-logs:create')
  create(
    @Body() dto: CreateActivityLogDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.activityLogsService.create({
      userId: user.sub,
      userEmail: user.email,
      userName: user.name,
      action: dto.action,
      details: dto.details,
    });
  }

  @Delete(':id')
  @RequirePermission('activity-logs:delete')
  remove(@Param('id') id: string) {
    return this.activityLogsService.remove(id);
  }
}
