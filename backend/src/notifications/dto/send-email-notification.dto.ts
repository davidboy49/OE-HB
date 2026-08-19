import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

/** Matches sendEmailNotificationAction(templateId, projectId, variables) in the old actions.ts. */
export class SendEmailNotificationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  templateId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
    description:
      '{{var}} interpolation values merged into the template, in addition to projectName/projectCode/recipientName',
  })
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;
}
