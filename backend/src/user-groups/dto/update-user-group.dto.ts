import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateUserGroupDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Keycloak group name (e.g. "/finance") that syncs members into this role on SSO sign-in',
  })
  @IsOptional()
  @IsString()
  keycloakGroup?: string | null;
}

export class CloneUserGroupDto {
  @ApiProperty({ description: 'Name of the new group' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}
