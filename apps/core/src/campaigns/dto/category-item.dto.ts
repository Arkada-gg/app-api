import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CategoryItemDto {
  @ApiProperty({ example: 'neemo-staking', description: 'Slug категории' })
  @IsString()
  slug: string;

  @ApiProperty({
    example: 'Neemo Staking',
    description: 'Название категории',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;
}
