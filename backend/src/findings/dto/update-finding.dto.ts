import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateFindingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiPropertyOptional({ enum: ['OPEN', 'UNDER_REVIEW', 'CLOSED'] })
  @IsOptional()
  @IsIn(['OPEN', 'UNDER_REVIEW', 'CLOSED'])
  status?: 'OPEN' | 'UNDER_REVIEW' | 'CLOSED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recommendation?: string;
}
