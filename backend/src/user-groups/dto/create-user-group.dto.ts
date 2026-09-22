import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateUserGroupDto {
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
