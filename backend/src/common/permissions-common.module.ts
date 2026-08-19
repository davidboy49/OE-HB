import { Global, Module } from '@nestjs/common';
import { PermissionsResolverService } from './permissions-resolver.service';

@Global()
@Module({
  providers: [PermissionsResolverService],
  exports: [PermissionsResolverService],
})
export class PermissionsCommonModule {}
