import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Mirrors dbService.updateEmailTemplate(id, subject, body) - id comes from the route param. */
export class UpdateEmailTemplateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body!: string;
}
