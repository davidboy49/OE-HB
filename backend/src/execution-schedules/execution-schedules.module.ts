import { Module } from '@nestjs/common';
import { ExecutionSchedulesService } from './execution-schedules.service';
import { ExecutionSchedulesController } from './execution-schedules.controller';

@Module({
  controllers: [ExecutionSchedulesController],
  providers: [ExecutionSchedulesService],
  exports: [ExecutionSchedulesService],
})
export class ExecutionSchedulesModule {}
