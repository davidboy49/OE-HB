import { Global, Module } from '@nestjs/common';
import { PermissionsResolverService } from './permissions-resolver.service';
import { AccessScopeService } from './access-scope.service';

@Global()
@Module({
  providers: [PermissionsResolverService, AccessScopeService],
  exports: [PermissionsResolverService, AccessScopeService],
})
export class PermissionsCommonModule {}
