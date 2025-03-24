import { ApiProperty } from '@nestjs/swagger';

export class CampaignStatsDto {
  @ApiProperty({ description: 'Total number of campaigns' })
  totalCampaigns: number;

  @ApiProperty({ description: 'Number of campaigns not completed' })
  notCompletedCampaigns: number;

  @ApiProperty({ description: 'Number of campaigns completed' })
  campaignsCompleted: number;

  @ApiProperty({ description: 'Average completion rate' })
  averageCompletion: number;

  @ApiProperty({ description: 'Average number of campaigns participated in' })
  averageParticipated: number;

  @ApiProperty({ description: 'Number of campaigns participated in' })
  participated: number;

  @ApiProperty({ description: 'Number of unique wallets that started at least one quest' })
  uniqueWalletsStartedOneQuest: number;

  @ApiProperty({ description: 'Number of unique wallets that completed at least one quest' })
  uniqueWalletsCompletedOneQuest: number;
}
