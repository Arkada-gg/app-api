import { Module } from '@nestjs/common';
import { QuestController } from './quest.controller';
import { QuestService } from './quest.service';
import { QuestRepository } from './quest.repository';
import { DatabaseModule } from '../database/database.module';
import { UserModule } from '../user/user.module';
import { CampaignModule } from '../campaigns/campaign.module';

@Module({
  imports: [DatabaseModule, UserModule, CampaignModule],
  controllers: [QuestController],
  providers: [QuestService, QuestRepository],
})
export class QuestModule {}
