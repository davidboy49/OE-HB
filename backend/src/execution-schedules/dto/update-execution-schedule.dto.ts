import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

/**
 * Broad partial matching dbService.updateExecutionSchedule's accepted fields
 * (frontend/src/lib/dbService.ts:1464-1483). Intentionally excludes
 * projectId/qrToken/departmentConsents - not updatable via this route.
 */
export class UpdateExecutionScheduleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departments?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  visitNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actualVisitDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  oePeriod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  leadExecution?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamMembers?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  additionalAttendees?: string;

  @ApiPropertyOptional({
    description: 'JSON-serialized { [departmentId]: confirmationValue } map',
  })
  @IsOptional()
  @IsString()
  attendeeConfirmations?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  standards?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({
    description:
      'Free-form status string (schema default "DRAFT"); e.g. DRAFT/RELEASED.',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  objectives?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scope?: string;

  @ApiPropertyOptional({
    description:
      'JSON-serialized array of schedule rows: [{ date, time, activity, conductBy, pIncharge }]',
  })
  @IsOptional()
  @IsString()
  scheduleRows?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastModifiedBy?: string;

  @ApiPropertyOptional({
    description:
      'The updatedAt this edit was based on. When given, the save is rejected (409) if ' +
      'someone else has changed the schedule since - protects scheduleRows and other fields ' +
      'from a silent last-write-wins overwrite when two people edit the same schedule at once.',
  })
  @IsOptional()
  @IsDateString()
  expectedUpdatedAt?: string;
}
