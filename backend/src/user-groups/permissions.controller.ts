import { Controller, Get } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import type { Type } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserGroupsService } from './user-groups.service';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { inventoryRoutes } from '../common/route-inventory';
import { PERMISSION_CATALOG, moduleOf } from '../common/permissions';

@ApiTags('permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(
    private readonly userGroupsService: UserGroupsService,
    private readonly discovery: DiscoveryService,
  ) {}

  /** Every permission with its title, module, risk tags and the scopes it supports. */
  @Get()
  @RequirePermission('user-groups:view')
  findAll() {
    return this.userGroupsService.listCatalog();
  }

  /**
   * API Resource Policies: every HTTP route and the permission that guards it, read from the
   * code that actually enforces it (so this list can never disagree with reality).
   */
  @Get('routes')
  @RequirePermission('user-groups:view')
  routes() {
    const controllers = this.discovery
      .getControllers()
      .map((w) => w.metatype)
      .filter((m): m is Type<unknown> => typeof m === 'function');

    const catalog = new Map(PERMISSION_CATALOG.map((p) => [p.key, p]));
    return inventoryRoutes(controllers)
      .map((r) => {
        const keys = r.permission ? r.permission.split(' | ') : [];
        const metas = keys.flatMap((k) => catalog.get(k) ?? []);
        return {
          method: r.method,
          path: r.path,
          access: r.access,
          permissions: keys,
          dynamic: r.dynamic ?? false,
          title: metas.length ? metas.map((m) => m.title).join(' / ') : null,
          module: keys.length ? moduleOf(keys[0]) : null,
          risks: [...new Set(metas.flatMap((m) => m.risks))],
        };
      })
      .sort(
        (a, b) =>
          a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
      );
  }
}
