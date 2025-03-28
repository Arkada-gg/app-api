// src/alchemy/alchemy.module.ts
import { Module } from '@nestjs/common';
import { _ConfigModule } from '../_config/config.module';
import { DatabaseModule } from '../database/database.module';
import { QuestModule } from '../quests/quest.module';
import { AlchemyQueueModule } from '../queues/alchemy-queue.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { UserModule } from '../user/user.module';
import { AlchemyCommonModule } from './alchemy-common.module';
import { AlchemyWebhooksController } from './alchemy.controller';
import { AlchemyWebhooksService } from './alchemy.service';

@Module({
  imports: [
    AlchemyCommonModule,
    AlchemyQueueModule,
    UserModule,
    TransactionsModule,
    QuestModule,
    _ConfigModule,
    DatabaseModule,
  ],
  controllers: [AlchemyWebhooksController],
  providers: [AlchemyWebhooksService],
  exports: [AlchemyWebhooksService],
})
export class AlchemyModule { }
