import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class CacheService {
  public static cachePrefix = "cache:" as const;
  constructor(private readonly redisService: RedisService) { }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const client = this.redisService.getClient();
    const strValue = typeof value === 'string' ? value : JSON.stringify(value);

    if (ttl) {
      await client.set(this.addCachePrefix(key), strValue, 'EX', ttl);
    } else {
      await client.set(this.addCachePrefix(key), strValue);
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    const client = this.redisService.getClient();
    const data = await client.get(this.addCachePrefix(key));
    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as T;
    } catch {
      return data as any as T;
    }
  }

  async del(key: string): Promise<void> {
    const client = this.redisService.getClient();
    await client.del(key);
  }

  async flushAll(): Promise<void> {
    const client = this.redisService.getClient();
    await client.flushall();
  }

  private addCachePrefix(key: string): string {
    return `${CacheService.cachePrefix}${key}`
  }
}
