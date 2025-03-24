import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { CacheService } from './cache.service';
import { _ConfigModule } from '../_config/config.module';

@Global()
@Module({
  providers: [RedisService, CacheService],
  exports: [RedisService, CacheService],
  imports: [_ConfigModule]
})
export class RedisModule { }
