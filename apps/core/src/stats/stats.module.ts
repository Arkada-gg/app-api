import { Module } from '@nestjs/common';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';
import { UserModule } from '../user/user.module';
import { CampaignModule } from '../campaigns/campaign.module';

@Module({
  providers: [StatsService],
  controllers: [StatsController],
  imports: [UserModule, CampaignModule]
})
export class StatsModule { }
