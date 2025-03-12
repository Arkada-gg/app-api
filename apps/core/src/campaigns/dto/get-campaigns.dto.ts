import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsArray, ValidateNested } from 'class-validator';
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
    default: [{ slug: 'slug' }],
    description: 'Slug',
  })
  @IsArray()
  @Transform(({ value }) => {
    try {
      if (!value) return undefined;
      let arr;
      if (typeof value === 'string') {
        try {
          arr = JSON.parse(value);
        } catch (e) {
          throw new Error('category must be a valid JSON array');
        }
      } else {
        arr = value;
      }
      if (!Array.isArray(arr)) {
        throw new Error('category must be an array');
      }
      return arr.map((item, index) => {
        if (typeof item !== 'object' || item === null) {
          throw new Error(`category[${index}] must be an object`);
        }
        if (!item.slug || typeof item.slug !== 'string') {
          throw new Error(`category[${index}].slug must be a string`);
        }
        return {
          slug: item.slug,
          name: item.name ? String(item.name) : undefined,
        };
      });
    } catch (error) {
      throw new BadRequestException('Not valid data');
    }
  })
  category?: { slug: string; name?: string }[];
}
