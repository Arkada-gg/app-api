import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redis, { RedisOptions } from 'ioredis';
import fetch from 'node-fetch';

@Injectable()
export class PriceService {
  private readonly logger = new Logger(PriceService.name);
  private redisClient: Redis;

  private tokenToCoingeckoId: Record<string, string> = {
    ethereum: 'ethereum',
    astroport: 'astar',
    vastr: 'bifrost-voucher-astr',
    yayeth: 'yay-stakestone-ether',
    swapx: 'swapx-2',
  };

  constructor() {
    const port = parseInt(process.env.REDIS_PORT?.trim() || '', 10);

    if (isNaN(port)) {
      throw new Error(
        `Invalid REDIS_PORT value: "${process.env.REDIS_PORT}". Must be a valid number.`
      );
    }


    const redisConfig: RedisOptions = {
      host: process.env.REDIS_HOST,
      port,
    }

    if (process.env.NODE_ENV !== 'development') {
      // TODO: refactor
      redisConfig.username = process.env.REDIS_USERNAME
      redisConfig.password = process.env.REDIS_PASSWORD
      redisConfig.tls = { rejectUnauthorized: false }
    }

    this.redisClient = new Redis(redisConfig);
  }

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
          await this.redisClient.set(key, priceObj.usd.toString());
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

  async getTokenPrice(tokenId: string): Promise<number> {
    try {
      const key = `coin:price:${tokenId}`;
      const priceStr = await this.redisClient.get(key);
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
