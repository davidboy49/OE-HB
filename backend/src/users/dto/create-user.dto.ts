import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import type { UserRole } from '@auditdesk/shared';

const USER_ROLES: UserRole[] = ['ADMIN', 'LEAD_AUDITOR', 'AUDITOR', 'AUDITEE'];

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: USER_ROLES })
  @IsIn(USER_ROLES)
  role!: UserRole;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  departmentId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  groupId?: string | null;

  @ApiPropertyOptional({
    description:
      'Initial password. If omitted, an admin sets one later via PATCH /users/:id/password.',
  })
  @IsOptional()
  @IsString()
  password?: string;
}
