import { Module } from '@nestjs/common';
import { _ConfigModule } from '../_config/config.module';
import { AuthModule } from '../auth/auth.module';
import { CampaignModule } from '../campaigns/campaign.module';
import { DatabaseModule } from '../database/database.module';
import { DiscordModule } from '../discord/discord.module';
import { IpfsModule } from '../ipfs/ipfs.module';
import { PriceModule } from '../price/price.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { UserModule } from '../user/user.module';
import { NftController } from './nft.controller';
import { QuestController } from './quest.controller';
import { QuestRepository } from './quest.repository';
import { QuestService } from './quest.service';

@Module({
  imports: [
    DatabaseModule,
    UserModule,
    CampaignModule,
    PriceModule,
    AuthModule,
    TransactionsModule,
    DiscordModule,
    _ConfigModule,
    IpfsModule,
  ],
  controllers: [QuestController, NftController],
  providers: [QuestService, QuestRepository],
  exports: [QuestService],
})
export class QuestModule {}
