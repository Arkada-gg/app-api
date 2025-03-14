import { Controller, Logger, Post, UnauthorizedException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import axios, { AxiosResponse } from 'axios';
import { UserService } from '../user/user.service';
import { GetUserId } from '../auth/user.decorator';

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

@Controller('wallet-score')
export class WalletScoreController {
  private readonly logger = new Logger(WalletScoreController.name);

  private readonly API_KEY = process.env.DEBANK_API_KEY;
  private readonly BASE_URL = 'https://pro-openapi.debank.com/v1';

  private readonly targetChains: string[] = [
    'eth',
    'soneium',
    'base',
    'arb',
    'bsc',
    'avax',
    'matic',
    'op',
    'mantle',
    'tron'
  ];

  constructor(private readonly userService: UserService) { }

  @Post('update')
  @ApiOperation({ summary: 'Обновить Wallet Score для текущего пользователя' })
  @ApiResponse({ status: 200, description: 'Обновление завершено' })
  @ApiResponse({ status: 401, description: 'Не аутентифицирован' })
  @ApiResponse({ status: 400, description: 'Запрос возможен только раз в день' })
  @ApiResponse({ status: 500, description: 'Ошибка обновления' })
  async updateWalletScore(@GetUserId() userId: string) {
    this.logger.log('Запуск обновления Wallet Score для пользователя...');

    if (!userId) {
      throw new UnauthorizedException('Не аутентифицирован');
    }

    const user = await this.userService.findByAddress(userId);
    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }

    const now = new Date();

    if (user.last_wallet_score_update) {
      const lastUpdate = new Date(user.last_wallet_score_update);
      const oneDayInMs = 24 * 60 * 60 * 1000;
      if (now.getTime() - lastUpdate.getTime() < oneDayInMs) {
        throw new BadRequestException('Обновление возможно только раз в день');
      }
    }

    try {
      const walletAddress = user.address;
      const balanceData = await this.fetchWalletBalance(walletAddress);
      const totalBalance = this.calculateTotalBalance(balanceData);
      const points = this.calculatePoints(totalBalance);

      await this.userService.setWalletScorePoints(user.address, points.basePoints, points.additionalPoints);
      await this.userService.updateLastWalletScoreUpdate(user.address, now);

      this.logger.log(
        `✅ User ${user.address} (${walletAddress}): balance=$${totalBalance.toFixed(2)}, basePoints=${points.basePoints}, additionalPoints=${points.additionalPoints}`
      );

      return { message: 'Wallet Score обновлен', balance: totalBalance.toFixed(2), basePoints: points.basePoints, additionalPoints: points.additionalPoints };
    } catch (error) {
      this.logger.error(`Ошибка в обновлении WalletScore: ${(error as Error).message}`);
      throw new InternalServerErrorException(`Ошибка обновления: ${(error as Error).message}`);
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