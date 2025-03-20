import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetCampaignDto {
  @ApiProperty({ description: 'ID или Slug кампании', example: 'summer-sale' })
  @IsString()
  @IsNotEmpty()
  idOrSlug: string;
}
