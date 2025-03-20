import { Module } from '@nestjs/common';
import { AlchemyWebhooksService } from './alchemy.service';
import { UserModule } from '../user/user.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { QuestModule } from '../quests/quest.module';
import { _ConfigModule } from '../_config/config.module';

@Module({
  imports: [
    UserModule,
    TransactionsModule,
    QuestModule,
    _ConfigModule,
  ],
  providers: [AlchemyWebhooksService],
  exports: [AlchemyWebhooksService],
})
export class AlchemyCommonModule { }
