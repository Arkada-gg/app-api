// redis.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import Redis, { RedisOptions } from 'ioredis';
import { ConfigService } from '../_config/config.service';

@Injectable()
export class RedisService implements OnModuleInit {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) { }

  onModuleInit() {
    const port = parseInt(this.configService.getOrThrow('REDIS_PORT')?.trim() || '', 10);

    if (isNaN(port)) {
      throw new Error(
        `Invalid REDIS_PORT value: "${this.configService.get('REDIS_PORT')}". Must be a valid number.`,
      );
    }

    const redisConfig: RedisOptions = {
      host: this.configService.getOrThrow('REDIS_HOST'),
      port,
    };

    if (!process.env.IS_LOCAL_DEV) {
      redisConfig.username = this.configService.getOrThrow('REDIS_USERNAME');
      redisConfig.password = this.configService.getOrThrow('REDIS_PASSWORD');
      redisConfig.tls = { rejectUnauthorized: false };
    }

    this.client = new Redis(redisConfig);

    this.logger.log('Redis client has been initialized');
  }

  getClient(): Redis {
    return this.client;
  }
}
