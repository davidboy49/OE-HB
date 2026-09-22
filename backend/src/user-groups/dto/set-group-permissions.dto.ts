import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ACCESS_SCOPES } from '../../common/permissions';

export class GrantDto {
  @ApiProperty({ example: 'oe-plans:view' })
  @IsString()
  key!: string;

  @ApiPropertyOptional({
    enum: ACCESS_SCOPES,
    description:
      'How far the grant reaches. Defaults to ALL. Only "view" of record modules can be narrower.',
  })
  @IsOptional()
  @IsIn([...ACCESS_SCOPES])
  scope?: (typeof ACCESS_SCOPES)[number];
}

export class SetGroupPermissionsDto {
  @ApiProperty({
    type: [GrantDto],
    description: 'Full replacement list of grants for this group',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GrantDto)
  grants!: GrantDto[];
}
