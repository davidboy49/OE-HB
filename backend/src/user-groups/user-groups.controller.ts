import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SCOPE_RANK, UserGroupsService } from './user-groups.service';
import type { GrantChange } from './user-groups.service';
import { CreateUserGroupDto } from './dto/create-user-group.dto';
import {
  CloneUserGroupDto,
  UpdateUserGroupDto,
} from './dto/update-user-group.dto';
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
  @RequirePermission('user-groups:view')
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
    return this.userGroupsService.create(
      dto.name,
      dto.description ?? '',
      dto.keycloakGroup,
    );
  }

  @Patch(':id')
  @RequirePermission('user-groups:update')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'UPDATE_USER_GROUP',
    details: `Updated user group ID: ${req.params.id} ("${req.body.name}")`,
  }))
  update(@Param('id') id: string, @Body() dto: UpdateUserGroupDto) {
    return this.userGroupsService.update(
      id,
      dto.name,
      dto.description ?? '',
      dto.keycloakGroup,
    );
  }

  @Delete(':id')
  @RequirePermission('user-groups:delete')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req) => ({
    action: 'DELETE_USER_GROUP',
    details: `Deleted user group ID: ${req.params.id}`,
  }))
  remove(@Param('id') id: string) {
    return this.userGroupsService.remove(id);
  }

  /** Copy a group, including every grant and its scope, under a new name. */
  @Post(':id/clone')
  @RequirePermission('user-groups:create')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req, result) => ({
    action: 'CLONE_USER_GROUP',
    details: `Copied user group ID: ${req.params.id} as "${(result as { name?: string })?.name ?? req.body.name}"`,
  }))
  async clone(
    @Param('id') id: string,
    @Body() dto: CloneUserGroupDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // A copy carries the source group's grants, so it is subject to the same
    // "you cannot hand out more than you hold" rule as editing them.
    await this.assertMayGrant(
      user,
      await this.userGroupsService.getGrants(id),
      [],
    );
    return this.userGroupsService.clone(id, dto.name);
  }

  @Get(':id/permissions')
  @RequirePermission('user-groups:view')
  getPermissions(@Param('id') id: string) {
    return this.userGroupsService.getGrants(id);
  }

  @Patch(':id/permissions')
  @RequirePermission('user-groups:manage-permissions')
  @UseInterceptors(ActivityLogInterceptor)
  @LogActivity((req, result) => {
    const c = result as GrantChange | undefined;
    const list = (keys: string[]) =>
      keys.length ? ` [${keys.join(', ')}]` : '';
    return {
      action: 'UPDATE_GROUP_PERMISSIONS',
      details: c
        ? `Updated grants for user group ID: ${req.params.id}: ${c.granted.length} granted${list(c.granted)}, ${c.revoked.length} revoked${list(c.revoked)}, ${c.scopeChanged.length} scope changed${list(c.scopeChanged)}`
        : `Updated grants for user group ID: ${req.params.id}`,
    };
  })
  async setPermissions(
    @Param('id') id: string,
    @Body() dto: SetGroupPermissionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const current = await this.userGroupsService.getGrants(id);
    await this.assertMayGrant(
      user,
      dto.grants.map((g) => ({ key: g.key, scope: g.scope ?? 'ALL' })),
      current,
    );
    return this.userGroupsService.setGrants(id, dto.grants);
  }

  /**
   * Can't hand out more than you hold - a caller with user-groups:manage-permissions must
   * not be able to escalate a group (including their own) beyond their own effective grants,
   * neither by adding a permission they lack nor by widening a scope beyond theirs. Revoking,
   * narrowing and leaving things as they were are always allowed; only new or widened grants
   * are checked. Always run against DB-fresh grants: a member of the Administrators group
   * already holds every key at ALL, so this stays a no-op for them with no separate bypass.
   */
  private async assertMayGrant(
    user: AuthenticatedUser,
    wanted: { key: string; scope: keyof typeof SCOPE_RANK }[],
    current: { key: string; scope: keyof typeof SCOPE_RANK }[],
  ) {
    const before = new Map(current.map((g) => [g.key, g.scope]));
    const mine = await this.permissionsResolver.getGrants(user.sub);
    const problems: string[] = [];
    for (const g of wanted) {
      if (before.get(g.key) === g.scope) continue;
      const held = mine[g.key];
      if (!held) problems.push(`${g.key} (you do not hold it)`);
      else if (SCOPE_RANK[g.scope] > SCOPE_RANK[held]) {
        problems.push(`${g.key} at ${g.scope} (yours is ${held})`);
      }
    }
    if (problems.length > 0) {
      throw new ForbiddenException(
        `Cannot grant more than you hold: ${problems.join(', ')}`,
      );
    }
  }
}
