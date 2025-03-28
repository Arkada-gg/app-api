import { Module } from '@nestjs/common';
import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';
import { CampaignRepository } from './campaign.repository';
import { DatabaseModule } from '../database/database.module';
import { CampaignStatusJob } from './jobs/update-campaign-status.job';

@Module({
  imports: [DatabaseModule],
  controllers: [CampaignController],
  providers: [CampaignService, CampaignRepository, CampaignStatusJob],
  exports: [CampaignService],
})
export class CampaignModule {}
