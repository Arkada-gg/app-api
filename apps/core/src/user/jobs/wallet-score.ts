import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios, { AxiosResponse } from 'axios';
import { UserService } from '../user.service';

interface DeBankBalanceResponse {
  total_usd_value: number;
  chain_list: ChainData[];
}

interface ChainData {
  id: string;
  community_id: number;
  name: string;
  logo_url: string | null;
  native_token_id: string;
  wrapped_token_id: string;
  usd_value: number;
}

@Injectable()
export class WalletScoreJob {
  private readonly logger = new Logger(WalletScoreJob.name);

  private readonly API_KEY = process.env.DEBANK_API_KEY;
  private readonly BASE_URL = 'https://pro-openapi.debank.com/v1';

  // Список интересующих блокчейнов
  private readonly targetChains: string[] = [
    'eth',      // Ethereum
    'soneium',  // Soneium
    'base',     // Base
    'arb',      // Arbitrum
    'bsc',      // BSC
    'avax',     // Avalanche
    'matic',    // Polygon
    'op',       // Optimism
    'mantle',   // Mantle
    'tron'      // Tron
  ];

  constructor(private readonly userService: UserService) {}

  @Cron('0 0 * * 0') 
  async handleWalletScoreJob() {
    this.logger.log('Starting WalletScoreJob');

    try {
      const BATCH_SIZE = 20;
      let offset = 0;

      while (true) {
        const users = await this.userService.findUsersWithWalletChunk(offset, BATCH_SIZE);
        if (users.length === 0) break;

        this.logger.log(`Обрабатываем ${users.length} пользователей...`);

        await Promise.allSettled(
          users.map(async (user) => {
            const walletAddress = user.walletAddress;
            if (!walletAddress) return;

            try {
              const balanceData = await this.fetchWalletBalance(walletAddress);
              const totalBalance = this.calculateTotalBalance(balanceData);
              const points = this.calculatePoints(totalBalance);

              await this.userService.setWalletScorePoints(user.id, points.basePoints, points.additionalPoints);

              this.logger.log(
                `✅ User ${user.id} (${walletAddress}): balance=$${totalBalance.toFixed(2)}, basePoints=${points.basePoints}, additionalPoints=${points.additionalPoints}`
              );
            } catch (err) {
              this.logger.warn(
                `⚠️ Ошибка запроса для ${walletAddress}: ${(err as Error).message}`
              );
            }
          })
        );

        this.logger.log(
          `Батч из ${users.length} пользователей обработан. Ожидание 3 секунд...`
        );

        await this.sleep(3000); 

        offset += users.length;
      }

      this.logger.log('WalletScore обновлен для всех пользователей.');
    } catch (error) {
      this.logger.error(`WalletScoreJob failed: ${(error as Error).message}`);
    }
  }

  private async fetchWalletBalance(walletAddress: string): Promise<DeBankBalanceResponse> {
    const url = `${this.BASE_URL}/user/total_balance`;

    const resp: AxiosResponse<DeBankBalanceResponse> = await axios.get(url, {
      params: {
        id: walletAddress
      },
      headers: {
        'accept': 'application/json',
        'AccessKey': this.API_KEY
      }
    });

    return resp.data;
  }

  private calculateTotalBalance(data: DeBankBalanceResponse): number {
    const filteredChains = data.chain_list.filter(chain => this.targetChains.includes(chain.id));
    return filteredChains.reduce((sum, chain) => sum + chain.usd_value, 0);
  }

  private calculatePoints(balance: number): { basePoints: number; additionalPoints: number } {
    let basePoints = 0;
    let additionalPoints = 0;

    if (balance > 500000) {
      basePoints = 450;
      additionalPoints = 150;
    } else if (balance > 300000) {
      basePoints = 300;
      additionalPoints = 100;
    } else if (balance > 100000) {
      basePoints = 200;
      additionalPoints = 150;
    } else if (balance > 10000) {
      basePoints = 50;
      additionalPoints = 40;
    } else if (balance > 1000) {
      basePoints = 10;
      additionalPoints = 10;
    }

    return { basePoints, additionalPoints };
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}