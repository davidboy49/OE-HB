import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAuditProjectDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description:
      'Document code. Omit (or pass "AUTO") to auto-generate via CodeGeneratorService.',
    default: 'AUTO',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({
    enum: ['PLANNING', 'SUBMITTED_FOR_APPROVAL', 'RELEASED', 'CLOSED'],
  })
  @IsString()
  @IsNotEmpty()
  status!: string;

  @ApiProperty()
  @IsString()
  scope!: string;

  @ApiProperty()
  @IsString()
  planningDetails!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  startDate!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  endDate!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  leadAuditorId?: string | null;

  @ApiPropertyOptional({ default: '' })
  @IsOptional()
  @IsString()
  departments?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  annualPlanId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  auditPlanId?: string | null;
}
