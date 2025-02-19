import { Module } from '@nestjs/common';
import { QuestController } from './quest.controller';
import { QuestService } from './quest.service';
import { QuestRepository } from './quest.repository';
import { DatabaseModule } from '../database/database.module';
import { UserModule } from '../user/user.module';
import { CampaignModule } from '../campaigns/campaign.module';
import { PriceModule } from '../price/price.module';
import { NftController } from './nft.controller';
import { AuthModule } from '../auth/auth.module';
import { DailyCheckJob } from './jobs/daily-check.job';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [
    DatabaseModule,
    UserModule,
    CampaignModule,
    PriceModule,
    AuthModule,
    TransactionsModule
  ],
  controllers: [QuestController, NftController],
  providers: [QuestService, QuestRepository, DailyCheckJob],
})
export class QuestModule {}
