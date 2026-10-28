import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ description: 'Short code (max 3 characters), e.g. "FIN"; unique within the Business Unit' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  code!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'The Business Unit this department belongs to' })
  @IsString()
  @IsNotEmpty()
  businessUnitId!: string;
}
