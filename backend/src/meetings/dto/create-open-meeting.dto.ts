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
  oePeriod!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  leadExecution!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  teamMembers!: string;

  @ApiPropertyOptional({ description: 'Defaults to "".' })
  @IsOptional()
  @IsString()
  additionalAttendees?: string;

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
    description: 'Ignored - a new Open Meeting always starts as DRAFT.',
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
    description: 'Ignored - set server-side from the authenticated user.',
  })
  @IsOptional()
  @IsString()
  ownerName?: string;

  @ApiPropertyOptional({
    description: 'Ignored - set server-side from the authenticated user.',
  })
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
