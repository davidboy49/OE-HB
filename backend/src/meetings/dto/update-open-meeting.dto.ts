import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/** Mirrors the fields dbService.updateOpenMeeting maps into Prisma.OpenMeetingUpdateInput (dbService.ts:1156-1184). */
export class UpdateOpenMeetingDto {
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
  auditPeriod?: string;

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

  @ApiPropertyOptional({
    description: 'Free-form status string; e.g. DRAFT/RELEASED.',
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentConcern?: string;

  @ApiPropertyOptional({
    description:
      'JSON-serialized array of schedule rows: [{ date, time, activity, conductBy, pIncharge }]',
  })
  @IsOptional()
  @IsString()
  scheduleRows?: string;

  @ApiPropertyOptional({ description: 'JSON-serialized array of attachments' })
  @IsOptional()
  @IsString()
  attachments?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastModifiedBy?: string;
}
