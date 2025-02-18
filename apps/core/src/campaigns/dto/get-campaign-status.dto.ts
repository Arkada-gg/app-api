import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetCampaignStatusDto {
  @ApiProperty({
    description: 'Массив ID или Slug кампании',
    example: ['summer-sale'],
  })
  @IsNotEmpty()
  campaignIds: string[];

  @ApiProperty({ description: 'Адрес Юзера', example: '0x84fsdjf...' })
  @IsString()
  @IsNotEmpty()
  userAddress: string;
}
