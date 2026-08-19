import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class CreateFindingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] })
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity!: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @ApiProperty({ enum: ['OPEN', 'UNDER_REVIEW', 'CLOSED'] })
  @IsIn(['OPEN', 'UNDER_REVIEW', 'CLOSED'])
  status!: 'OPEN' | 'UNDER_REVIEW' | 'CLOSED';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  recommendation!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  executionScheduleId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  auditorId!: string;
}
