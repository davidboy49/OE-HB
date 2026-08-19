import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateAttachmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiProperty()
  @IsNumber()
  fileSize!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fileType!: string;

  @ApiProperty({ description: 'Base64-encoded file data' })
  @IsString()
  fileData!: string;
}
