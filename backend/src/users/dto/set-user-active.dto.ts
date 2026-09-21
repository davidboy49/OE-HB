import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetUserActiveDto {
  @ApiProperty({
    description: 'false = the person can no longer sign in or use the system',
  })
  @IsBoolean()
  isActive!: boolean;
}
