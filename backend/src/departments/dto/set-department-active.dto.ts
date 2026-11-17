import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetDepartmentActiveDto {
  @ApiProperty({
    description: 'false = the department can no longer be picked for new records',
  })
  @IsBoolean()
  isActive!: boolean;
}
