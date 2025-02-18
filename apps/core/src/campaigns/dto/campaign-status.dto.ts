import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CampaignStatusDto {
  @ApiProperty({ description: 'ID или Slug кампании', example: 'summer-sale' })
  @IsString()
  @IsNotEmpty()
  campaignId: string;

  @ApiProperty({ description: 'Статус', example: 'completed' })
  @IsString()
  @IsNotEmpty()
  status: string;
}
