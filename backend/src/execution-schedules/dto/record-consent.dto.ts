import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

const CONSENT_STATUSES = ['ACCEPTED', 'REVISION_REQUESTED'];

/**
 * Body for the authenticated department-consent route on ExecutionSchedulesController.
 * Mirrors actions.ts's recordDepartmentConsentAction, minus the identity fields
 * (acceptedByUserId/Name/Email) - those come from the authenticated @CurrentUser() here.
 */
export class RecordConsentDto {
  @ApiProperty({ enum: CONSENT_STATUSES })
  @IsIn(CONSENT_STATUSES)
  status!: 'ACCEPTED' | 'REVISION_REQUESTED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comments?: string;
}
