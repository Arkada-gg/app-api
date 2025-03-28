import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redis from 'ioredis';
import fetch from 'node-fetch';
import { CacheService } from '../redis/cache.service';

@Injectable()
export class PriceService {
  private readonly logger = new Logger(PriceService.name);
  private redisClient: Redis;

  private tokenToCoingeckoId = {
    ethereum: 'ethereum',
    astroport: 'astar',
    vastr: 'bifrost-voucher-astr',
    yayeth: 'yay-stakestone-ether',
    swapx: 'swapx-2'
  };

  constructor(private readonly cacheService: CacheService) { }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async updatePrices() {
    try {
      this.logger.debug('Start job: updatePrices');

      const tokens = Object.values(this.tokenToCoingeckoId);
      const ids = tokens.join(',');

      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
      const response = await fetch(url);
      if (!response.ok) {
        this.logger.error(`CoinGecko request failed: ${response.statusText}`);
        return;
      }

      const data: Record<string, { usd: number }> = await response.json();

      for (const [tokenId, priceObj] of Object.entries(data)) {
        if (priceObj?.usd) {
          const key = `coin:price:${tokenId}`;
          await this.cacheService.set(key, priceObj.usd.toString());
          this.logger.debug(`Updated price in Redis: ${key} = ${priceObj.usd}`);
        }
      }

      this.logger.debug('Finish job: updatePrices');
    } catch (error) {
      this.logger.error(
        `Error in updatePrices job: ${error.message}`,
        error.stack
      );
    }
  }

  async getTokenPrice(tokenId: string | keyof typeof this.tokenToCoingeckoId): Promise<number> {
    try {
      const key = `coin:price:${tokenId}`;
      const priceStr = await this.cacheService.get(key);
      if (!priceStr) {
        this.logger.warn(`Price not found in Redis for token: ${tokenId}`);
        return 0;
      }
      return parseFloat(priceStr);
    } catch (error) {
      this.logger.error(`Error reading price from Redis: ${error.message}`);
      return 0;
    }
  }
}
