import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum CampaignType {
  BASIC = 'basic',
  PREMIUM = 'premium',
}

export class GetCampaignsDto {
  @ApiPropertyOptional({ enum: CampaignType, description: 'Тип кампании' })
  @IsOptional()
  @IsEnum(CampaignType)
  type?: CampaignType;

  @ApiPropertyOptional({ description: 'Номер страницы', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Количество элементов на странице',
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}
