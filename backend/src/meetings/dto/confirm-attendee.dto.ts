import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmAttendeeDto {
  /** Matched against a name in teamMembers/additionalAttendees; who confirmed and when are set server-side. */
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  attendeeName!: string;
}
