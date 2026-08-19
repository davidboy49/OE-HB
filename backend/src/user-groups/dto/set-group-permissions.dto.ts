import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class SetGroupPermissionsDto {
  @ApiProperty({
    type: [String],
    description:
      'Full replacement list of permission keys granted to this group',
  })
  @IsArray()
  @IsString({ each: true })
  permissionKeys!: string[];
}
