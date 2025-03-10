import { IsString, IsNotEmpty, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CampaignStatsDto {
  @ApiProperty({
    description: 'ID или Slug кампании',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsString()
  @IsNotEmpty()
  campaignId: string;

  @ApiProperty({
    description: 'Сколько всего квестов в кампании',
    example: 10,
  })
  @IsNumber()
  total_quest: number;

  @ApiProperty({
    description: 'Сколько квестов юзер выполнил',
    example: 3,
  })
  @IsNumber()
  quest_completed: number;
}
