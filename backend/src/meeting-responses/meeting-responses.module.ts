import { Module } from '@nestjs/common';
import { MeetingResponsesController } from './meeting-responses.controller';
import { MeetingResponsesService } from './meeting-responses.service';

@Module({
  controllers: [MeetingResponsesController],
  providers: [MeetingResponsesService],
})
export class MeetingResponsesModule {}
