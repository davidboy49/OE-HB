import {
  Body,
  Controller,
  ForbiddenException,
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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PermissionsResolverService } from '../common/permissions-resolver.service';
import type { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('user-groups')
@ApiBearerAuth()
@Controller('user-groups')
export class UserGroupsController {
  constructor(
    private readonly userGroupsService: UserGroupsService,
    private readonly permissionsResolver: PermissionsResolverService,
  ) {}

  @Get()
  findAll() {
    return this.userGroupsService.findAll();
  }

  @Post()
  @RequirePermission('user-groups:create')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'CREATE_USER_GROUP',
    details: `Created user group "${req.body.name}"`,
  }))
  create(@Body() dto: CreateUserGroupDto) {
    return this.userGroupsService.create(dto.name, dto.description ?? '');
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
  async setPermissions(
    @Param('id') id: string,
    @Body() dto: SetGroupPermissionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Can't grant a permission you don't hold yourself - a non-ADMIN with
    // user-groups:manage-permissions must not be able to escalate a group
    // (including their own) beyond their own effective grants. Revoking is
    // always allowed; only newly-added keys are checked.
    if (user.role !== 'ADMIN') {
      const current = await this.userGroupsService.getGroupPermissions(id);
      const newlyGranted = dto.permissionKeys.filter(
        (key) => !current.includes(key),
      );
      const callerPermissions =
        await this.permissionsResolver.getEffectivePermissions(
          user.sub,
          user.role,
        );
      const disallowed = newlyGranted.filter(
        (key) => !callerPermissions.includes(key),
      );
      if (disallowed.length > 0) {
        throw new ForbiddenException(
          `Cannot grant permissions you do not hold: ${disallowed.join(', ')}`,
        );
      }
    }
    return this.userGroupsService.setGroupPermissions(id, dto.permissionKeys);
  }
}
