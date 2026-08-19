import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateOpenMeetingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  departments!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  visitNumber!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  actualVisitDate!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  auditPeriod!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  leadExecution!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  teamMembers!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  additionalAttendees!: string;

  @ApiPropertyOptional({
    description:
      'JSON-serialized { [departmentId]: confirmationValue } map. Defaults to "{}".',
  })
  @IsOptional()
  @IsString()
  attendeeConfirmations?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  standards!: string;

  @ApiPropertyOptional({
    description: 'Free-form status string; defaults to DRAFT.',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  objectives!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  scope!: string;

  @ApiPropertyOptional({ description: 'Defaults to "".' })
  @IsOptional()
  @IsString()
  departmentConcern?: string;

  @ApiProperty({
    description:
      'JSON-serialized array of schedule rows: [{ date, time, activity, conductBy, pIncharge }]',
  })
  @IsString()
  @IsNotEmpty()
  scheduleRows!: string;

  @ApiPropertyOptional({
    description: 'JSON-serialized array of attachments. Defaults to "[]".',
  })
  @IsOptional()
  @IsString()
  attachments?: string;

  @ApiPropertyOptional({ description: 'Defaults to "Sarah Jenkins".' })
  @IsOptional()
  @IsString()
  ownerName?: string;

  @ApiPropertyOptional({ description: 'Defaults to "Sarah Jenkins".' })
  @IsOptional()
  @IsString()
  lastModifiedBy?: string;

  @ApiPropertyOptional({
    description: 'Defaults to projectId, matching dbService.createOpenMeeting.',
  })
  @IsOptional()
  @IsString()
  qrToken?: string;

  @ApiPropertyOptional({
    description: 'JSON-serialized consent map. Defaults to "{}".',
  })
  @IsOptional()
  @IsString()
  departmentConsents?: string;
}
