import { Module } from '@nestjs/common';
import { _ConfigModule } from '../_config/config.module';
import { QuestModule } from '../quests/quest.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { UserModule } from '../user/user.module';
import { AlchemyWebhooksController } from './alchemy.controller';
import { AlchemyWebhooksService } from './alchemy.service';

@Module({
  imports: [UserModule, TransactionsModule, QuestModule, _ConfigModule],
  controllers: [AlchemyWebhooksController],
  providers: [AlchemyWebhooksService],
  exports: [AlchemyWebhooksService],
})
export class AlchemyModule {}
