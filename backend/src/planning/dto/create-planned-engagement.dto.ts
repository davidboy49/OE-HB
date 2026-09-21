import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePlannedEngagementDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  annualPlanId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  no!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  projectName!: string;

  @ApiProperty({ description: 'The single department this project is for' })
  @IsString()
  @IsNotEmpty()
  departmentId!: string;

  @ApiPropertyOptional({ default: 'OE' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ description: 'Comma-separated User IDs' })
  @IsString()
  @IsNotEmpty()
  revieweeIds!: string;

  @ApiProperty({ description: 'ISO date string' })
  @IsDateString()
  conductDate!: string;

  @ApiProperty({ description: 'ISO date string' })
  @IsDateString()
  endDate!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  durationDay!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  purpose!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  objectives?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scope?: string;
}
