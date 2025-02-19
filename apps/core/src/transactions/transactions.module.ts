import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [],
  controllers: [],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
