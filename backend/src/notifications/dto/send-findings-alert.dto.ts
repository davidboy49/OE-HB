import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/**
 * Matches the alertItems entries sendFindingsAlertEmailAction accepted in the old actions.ts.
 * The frontend pre-computes these via the shared `parseFindingAlerts` helper before calling in -
 * this endpoint itself never parses raw schedules, it only builds/logs the email previews.
 */
export class FindingAlertItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  documentCode?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departments?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  activity!: string;

  @ApiProperty({
    enum: ['MISSING_FINAL_DATE', 'PENDING_RESOLUTION', 'RESOLVED'],
  })
  @IsIn(['MISSING_FINAL_DATE', 'PENDING_RESOLUTION', 'RESOLVED'])
  alertType!: 'MISSING_FINAL_DATE' | 'PENDING_RESOLUTION' | 'RESOLVED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correctiveActionDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correctiveFinalDate?: string;
}

export class SendFindingsAlertDto {
  @ApiProperty({ type: [FindingAlertItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FindingAlertItemDto)
  alertItems!: FindingAlertItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customNote?: string;
}
