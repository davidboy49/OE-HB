import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateAuditPlanDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  projectName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  topic!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  bu!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  type!: string;

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
