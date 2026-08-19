import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateExecutionScheduleDto {
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
    description: 'JSON-serialized { [departmentId]: confirmationValue } map',
  })
  @IsOptional()
  @IsString()
  attendeeConfirmations?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  standards!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  language!: string;

  @ApiPropertyOptional({
    description:
      'Free-form status string (schema default "DRAFT"); e.g. DRAFT/RELEASED.',
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

  @ApiProperty({
    description:
      'JSON-serialized array of schedule rows: [{ date, time, activity, conductBy, pIncharge }]',
  })
  @IsString()
  @IsNotEmpty()
  scheduleRows!: string;

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
