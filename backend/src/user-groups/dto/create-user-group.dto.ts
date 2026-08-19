import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { UserRole } from '@auditdesk/shared';

const USER_ROLES: UserRole[] = ['ADMIN', 'LEAD_AUDITOR', 'AUDITOR', 'AUDITEE'];

export class CreateUserGroupDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: USER_ROLES })
  @IsIn(USER_ROLES)
  role!: UserRole;
}
