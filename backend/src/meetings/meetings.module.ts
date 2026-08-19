import { Module } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { MeetingsController } from './meetings.controller';
import { ExecutionSchedulesModule } from '../execution-schedules/execution-schedules.module';
import { DepartmentsModule } from '../departments/departments.module';

@Module({
  imports: [ExecutionSchedulesModule, DepartmentsModule],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
