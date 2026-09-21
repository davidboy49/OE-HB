import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

const CONSENT_STATUSES = ['ACCEPTED', 'REVISION_REQUESTED'];

/**
 * Body for the public QR-scan consent route (POST /meetings/qr/:qrToken/consent).
 *
 * Deviates from actions.ts's recordDepartmentConsentAction, which derived
 * acceptedByUserId/Name/Email from getCurrentUserServer() (falling back to a mock
 * admin user when unauthenticated). This route is @Public() - an external department PIC
 * scanning a physical QR code has no account/JWT - so the person's name/email are
 * collected directly as plain form fields instead, and acceptedByUserId is left
 * empty (there's no real user id for an anonymous consenter).
 */
export class RecordQrConsentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  departmentId!: string;

  @ApiProperty({ enum: CONSENT_STATUSES })
  @IsIn(CONSENT_STATUSES)
  status!: 'ACCEPTED' | 'REVISION_REQUESTED';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  acceptedByUserName!: string;

  @ApiProperty()
  @IsEmail()
  acceptedByUserEmail!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comments?: string;

  @ApiPropertyOptional({
    description:
      "That department's own Concern of the Department Owner, submitted by the person signing off for this department.",
  })
  @IsOptional()
  @IsString()
  departmentConcern?: string;
}
