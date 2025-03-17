import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsArray, ValidateNested, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CategoryItemDto } from './category-item.dto';
import { BadRequestException } from '@nestjs/common';

export enum CampaignType {
  BASIC = 'basic',
  PREMIUM = 'premium',
}
export class GetCampaignsDto {
  @ApiPropertyOptional({ enum: CampaignType, description: 'Тип кампании' })
  @IsOptional()
  type?: CampaignType;

  @ApiPropertyOptional({ default: 1, description: 'Номер страницы' })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 5, description: 'Размер страницы' })
  @IsOptional()
  limit?: number = 5;

  @IsOptional()
  @ApiPropertyOptional({
    default: ['slug'],
    description:
      'Список slug кампаний, разделённых запятыми. Пример: sonic,magic',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(JSON.parse(value)) && JSON.parse(value).length === 0)
      return [];
    return value.split(',').map((s: string) => s.trim());
  })
  category?: string[];
}
