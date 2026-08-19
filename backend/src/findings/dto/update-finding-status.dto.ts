import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateFindingStatusDto {
  @ApiProperty({ enum: ['OPEN', 'UNDER_REVIEW', 'CLOSED'] })
  @IsIn(['OPEN', 'UNDER_REVIEW', 'CLOSED'])
  status!: 'OPEN' | 'UNDER_REVIEW' | 'CLOSED';
}
