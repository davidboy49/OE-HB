import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class SendTestEmailDto {
  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  toEmail!: string;
}
