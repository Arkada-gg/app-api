import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IMintPyramidData } from '../interface/sign';

export class GetMintDataDto {
  @ApiProperty({ description: 'Адрес пользователя', example: '0x84fsdjf...' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiPropertyOptional({
    description: 'Айди компании или slug',
    example: 'sonnex',
  })
  @IsString()
  @IsNotEmpty()
  campaignIdOrSlug: string;

  @ApiProperty({ description: 'Подпись для верификации', example: '0x...' })
  @IsString()
  @IsOptional()
  signature: string;
}

export class GetMintDataResponse {
  @ApiProperty({ description: 'Данные для минта пирамиды' })
  data: IMintPyramidData;

  @ApiProperty({ description: 'Подпись для минта пирамиды' })
  signature: string;
}
