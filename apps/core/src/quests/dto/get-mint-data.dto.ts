import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

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
