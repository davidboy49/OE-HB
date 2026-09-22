import { Global, Module } from '@nestjs/common';
import { PermissionsResolverService } from './permissions-resolver.service';
import { AccessScopeService } from './access-scope.service';
import { PlanItemsService } from './plan-items.service';

// Despite the name (kept to avoid touching every module that already imports it), this is
// really "global common services" - PlanItemsService has nothing to do with permissions, it
// just needed a @Global() home too.
@Global()
@Module({
  providers: [PermissionsResolverService, AccessScopeService, PlanItemsService],
  exports: [PermissionsResolverService, AccessScopeService, PlanItemsService],
})
export class PermissionsCommonModule {}
