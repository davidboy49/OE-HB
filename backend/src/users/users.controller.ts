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
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserGroupAndDeptDto } from './dto/update-user-group-and-dept.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { SetUserActiveDto } from './dto/set-user-active.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { LogActivity } from '../common/decorators/log-activity.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @RequirePermission('users:view')
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @RequirePermission('users:create')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'CREATE_USER',
    details: `Created user "${req.body.name}" (${req.body.email})`,
  }))
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(
      dto.name,
      dto.email,
      dto.departmentId ?? null,
      dto.groupId ?? null,
      dto.password,
    );
  }

  @Patch(':id')
  @RequirePermission('users:update')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'UPDATE_USER',
    details: `Updated user "${req.body.name}" (${req.body.email})`,
  }))
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(
      id,
      dto.name,
      dto.email,
      dto.departmentId ?? null,
      dto.groupId ?? null,
    );
  }

  @Patch(':id/group-and-dept')
  @RequirePermission('users:update')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'UPDATE_USER_ROLES',
    details: `Updated department/group roles for user ID: ${req.params.id}`,
  }))
  updateGroupAndDept(
    @Param('id') id: string,
    @Body() dto: UpdateUserGroupAndDeptDto,
  ) {
    return this.usersService.updateGroupAndDept(
      id,
      dto.departmentId ?? null,
      dto.groupId ?? null,
    );
  }

  /** Deactivate or reactivate an account. Takes effect on the person's very next request. */
  @Patch(':id/active')
  @RequirePermission('users:update')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: req.body.isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
    details: `${req.body.isActive ? 'Reactivated' : 'Deactivated'} user ID: ${req.params.id}`,
  }))
  setActive(
    @Param('id') id: string,
    @Body() dto: SetUserActiveDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    if (!dto.isActive && id === actor.sub) {
      throw new BadRequestException('You cannot deactivate your own account.');
    }
    return this.usersService.setActive(id, dto.isActive);
  }

  @Patch(':id/password')
  @RequirePermission('users:set-password')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'SET_USER_PASSWORD',
    details: `Set a new password for user ID: ${req.params.id}`,
  }))
  async setPassword(@Param('id') id: string, @Body() dto: SetPasswordDto) {
    await this.authService.setPassword(id, dto.newPassword);
    return { success: true };
  }

  @Delete(':id')
  @RequirePermission('users:delete')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'DELETE_USER',
    details: `Deleted user ID: ${req.params.id}`,
  }))
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
