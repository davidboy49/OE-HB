import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { RESPONSE_STATUSES } from '../meeting-responses.rules';

export class UpsertMeetingResponseDto {
  @ApiProperty({ enum: RESPONSE_STATUSES })
  @IsIn([...RESPONSE_STATUSES])
  status!: (typeof RESPONSE_STATUSES)[number];

  @ApiPropertyOptional({
    description:
      "The respondent's Concern of the Department Owner (rich text). Sanitised server-side; required when requesting a revision.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(40_000)
  concern?: string;
}
