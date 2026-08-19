import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserGroupsService } from './user-groups.service';
import { CreateUserGroupDto } from './dto/create-user-group.dto';
import { SetGroupPermissionsDto } from './dto/set-group-permissions.dto';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { LogActivity } from '../common/decorators/log-activity.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@ApiTags('user-groups')
@ApiBearerAuth()
@Controller('user-groups')
export class UserGroupsController {
  constructor(private readonly userGroupsService: UserGroupsService) {}

  @Get()
  findAll() {
    return this.userGroupsService.findAll();
  }

  @Post()
  @RequirePermission('user-groups:create')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'CREATE_USER_GROUP',
    details: `Created user group "${req.body.name}" with ${req.body.role} access`,
  }))
  create(@Body() dto: CreateUserGroupDto) {
    return this.userGroupsService.create(
      dto.name,
      dto.description ?? '',
      dto.role,
    );
  }

  @Get(':id/permissions')
  getPermissions(@Param('id') id: string) {
    return this.userGroupsService.getGroupPermissions(id);
  }

  @Patch(':id/permissions')
  @RequirePermission('user-groups:manage-permissions')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'UPDATE_GROUP_PERMISSIONS',
    details: `Updated permissions for user group ID: ${req.params.id} (${Array.isArray(req.body.permissionKeys) ? req.body.permissionKeys.length : 0} granted)`,
  }))
  setPermissions(@Param('id') id: string, @Body() dto: SetGroupPermissionsDto) {
    return this.userGroupsService.setGroupPermissions(id, dto.permissionKeys);
  }
}
