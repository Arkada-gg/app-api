import { Module } from '@nestjs/common';
import { AlchemyWebhooksService } from './alchemy.service';
import { AlchemyWebhooksController } from './alchemy.controller';
import { UserModule } from '../user/user.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { _ConfigModule } from '../_config/config.module';

@Module({
  imports: [UserModule, TransactionsModule, _ConfigModule],
  controllers: [AlchemyWebhooksController],
  providers: [AlchemyWebhooksService],
  exports: [AlchemyWebhooksService],
})
export class AlchemyModule {}
