import { Module } from '@nestjs/common';
import { PriceService } from './price.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [],
  providers: [PriceService],
  exports: [PriceService],
})
export class PriceModule { }
