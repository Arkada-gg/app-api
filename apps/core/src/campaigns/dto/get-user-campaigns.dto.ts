import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { GetCampaignsDto } from './get-campaigns.dto';

export enum UserCampaignStatus {
  ACTIVE = 'active',
  STARTED = 'started',
  COMPLETED = 'completed',
}

export class GetUserCampaignsDto extends GetCampaignsDto {
  @ApiProperty({ description: 'Адрес пользователя', example: '0x84fsdjf...' })
  @IsString()
  @IsNotEmpty()
  userAddress: string;

  @ApiPropertyOptional({
    enum: UserCampaignStatus,
    description: 'Статус кампаний для пользователя',
    example: UserCampaignStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(UserCampaignStatus)
  status?: UserCampaignStatus;
}
