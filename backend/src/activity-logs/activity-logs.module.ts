import { Global, Module } from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service';
import { ActivityLogsController } from './activity-logs.controller';

/**
 * Global so ActivityLogInterceptor (used declaratively across every other
 * module) can inject ActivityLogsService without each module re-importing it.
 */
@Global()
@Module({
  controllers: [ActivityLogsController],
  providers: [ActivityLogsService],
  exports: [ActivityLogsService],
})
export class ActivityLogsModule {}
