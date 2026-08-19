import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateActivityLogDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  action!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  details!: string;
}
