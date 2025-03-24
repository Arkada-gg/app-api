import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { PurgeDailyChecksJob } from './jobs/delete-old-txns.job';

@Module({
  imports: [],
  controllers: [],
  providers: [TransactionsService, PurgeDailyChecksJob],
  exports: [TransactionsService],
})
export class TransactionsModule { }
