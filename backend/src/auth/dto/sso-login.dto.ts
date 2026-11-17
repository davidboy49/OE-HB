import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SsoLoginDto {
  /** Access token issued by the company Keycloak realm (from the mobile app's existing SSO login). */
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;
}
