import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

/**
 * Mirrors the broad `Partial<AuditProject>` shape the original dbService.updateProject
 * accepted. Intentionally permissive - the free-form JSON string fields (opExTimeline,
 * approvals) are validated only as strings, matching the original's lack of schema validation.
 */
export class UpdateAuditProjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    enum: ['PLANNING', 'SUBMITTED_FOR_APPROVAL', 'RELEASED', 'CLOSED'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    enum: ['DRAFTING', 'REVIEW', 'PENDING_PIC', 'APPROVED'],
  })
  @IsOptional()
  @IsString()
  workflowStage?: string;

  @ApiPropertyOptional({
    description:
      'Comma-separated list of User IDs representing department PICs',
  })
  @IsOptional()
  @IsString()
  deptPicIds?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated list of Department names',
  })
  @IsOptional()
  @IsString()
  departments?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scope?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  planningDetails?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  leadAuditorId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  auditorNames?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  objectives?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  riskProcess?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  riskClass?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  opEx?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fieldwork?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  outcome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dataRequestType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  focusArea?: string;

  @ApiPropertyOptional({ description: 'JSON-encoded string' })
  @IsOptional()
  @IsString()
  opExTimeline?: string;

  @ApiPropertyOptional({ description: 'JSON-encoded string' })
  @IsOptional()
  @IsString()
  approvals?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  annualPlanId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  auditPlanId?: string | null;

  @ApiPropertyOptional({
    type: [String],
    description: 'Array of selected auditor user IDs (or names)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  auditorIds?: string[];
}
