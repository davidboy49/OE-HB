import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAnnualPlanDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  planName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  period!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}
