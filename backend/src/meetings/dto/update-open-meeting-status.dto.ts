import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/** DRAFT -> SUBMITTED_FOR_APPROVAL -> RELEASED, with reject/reopen looping back to DRAFT. */
export const OPEN_MEETING_STATUSES = [
  'DRAFT',
  'SUBMITTED_FOR_APPROVAL',
  'RELEASED',
] as const;

export class UpdateOpenMeetingStatusDto {
  @ApiProperty({ enum: OPEN_MEETING_STATUSES })
  @IsIn(OPEN_MEETING_STATUSES)
  status!: (typeof OPEN_MEETING_STATUSES)[number];
}
