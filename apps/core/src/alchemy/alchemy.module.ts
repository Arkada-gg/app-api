// src/alchemy/alchemy.module.ts
import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { QuestModule } from '../quests/quest.module';
import { _ConfigModule } from '../_config/config.module';
import { AlchemyWebhooksController } from './alchemy.controller';
import { AlchemyWebhooksService } from './alchemy.service';
import { AlchemyQueueModule } from '../queues/alchemy-queue.module';
import { AlchemyCommonModule } from './alchemy-common.module';

@Module({
  imports: [
    AlchemyCommonModule,
    AlchemyQueueModule,
    UserModule,
    TransactionsModule,
    QuestModule,
    _ConfigModule,
  ],
  controllers: [AlchemyWebhooksController],
  providers: [AlchemyWebhooksService],
  exports: [AlchemyWebhooksService],
})
export class AlchemyModule { }
