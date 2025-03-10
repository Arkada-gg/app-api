import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IMintPyramidData } from '../interfaces/sign';

export class GetMintDataDto {
  @ApiProperty({ description: 'Адрес пользователя', example: '0x84fsdjf...' })
  @IsString()
  @IsNotEmpty()
  userAddress: string;

  @ApiPropertyOptional({
    description: 'Айди компании или slug',
    example: 'sonnex',
  })
  @IsString()
  @IsNotEmpty()
  campaignIdOrSlug: string;
}

export class GetMintDataResponse {
  @ApiProperty({ description: 'Данные для минта пирамиды' })
  data: IMintPyramidData;

  @ApiProperty({ description: 'Подпись для минта пирамиды' })
  signature: string;
}
