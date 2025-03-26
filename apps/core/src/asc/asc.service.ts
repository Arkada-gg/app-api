import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { stringify } from 'csv-stringify';
import Web3 from 'web3';
import { UserService } from '../user/user.service';
import { Multicall } from 'ethereum-multicall';

interface AcsDistributionItem {
  userAddress: string;
  defiId: number;
  acsAmount: number;
  description: string;
}

@Injectable()
export class AcsService {
  private readonly logger = new Logger(AcsService.name);
  private readonly API_SECRET = process.env.ACS_API_SECRET;
  private readonly GRAPHQL_URL = 'https://acs-graphql.astar.network/graphql';
  private readonly DEFI_ID = 28;
  private ACS_POOL: number;
  private readonly ACS_API_URL =
    'https://acs-api.astar.network/acs/addDiscretionaryPointsBatch';
  private readonly REPORTS_DIR = path.join(__dirname, '..', '..', 'reports');
  private readonly BATCH_SIZE = 500;

  private readonly NFT_MULTIPLIERS = [
    {
      address: '0x39dF84267Fda113298d4794948B86026EFD47e32'.toLowerCase(),
      multiplier: 1.1,
    },
    {
      address: '0x181b42ca4856237AE76eE8c67F8FF112491eCB9e'.toLowerCase(),
      multiplier: 1.2,
    },
    {
      address: '0xFAC5f5ccDc024BDDF9b0438468C27214E1b4C9f2'.toLowerCase(),
      multiplier: 1.3
    }
  ];
  private readonly ERC721_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
  ];

  constructor(private readonly userService: UserService) {
    if (!fs.existsSync(this.REPORTS_DIR)) {
      fs.mkdirSync(this.REPORTS_DIR);
    }
  }

  private async updateAcsPoolFromGraphQL(): Promise<void> {
    try {
      const query = `
        query ExampleQuery {
          getAllDefiRemainPoint {
            dailyPoints
            defiId
            defiName
            remainingPoints
            totalReceivedPoints
          }
        }
      `;
      const resp = await axios.post<{ data: { getAllDefiRemainPoint: any[] } }>(
        this.GRAPHQL_URL,
        { query }
      );
      const data = resp.data?.data?.getAllDefiRemainPoint ?? [];

      const found = data.find((item) => item.defiId === this.DEFI_ID);
      if (found) {
        this.ACS_POOL = found.remainingPoints;
        this.logger.log(
          `Успешно обновили значение ACS_POOL из GraphQL: ${this.ACS_POOL}`
        );
      } else {
        this.logger.warn(
          `Не нашли в GraphQL данных для defiId=${this.DEFI_ID}. Оставляем ACS_POOL=0.`
        );
        this.ACS_POOL = 0;
      }
    } catch (error) {
      this.logger.error(
        `Не удалось получить данные из GraphQL: ${error.message}`
      );
      this.ACS_POOL = 0;
    }
  }

  private generateNonce(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateSignature(
    items: AcsDistributionItem[],
    timestamp: number,
    nonce: string
  ): string {
    const signStr = items.reduce((acc, item, idx) => {
      const itemStr = Object.keys(item)
        .sort()
        .map((key) => `${key}=${item[key]}`)
        .join('&');
      return idx === 0 ? itemStr : `${acc}&${itemStr}`;
    }, '');

    const finalStr = `${signStr}&timestamp=${timestamp}&nonce=${nonce}`;

    return crypto
      .createHmac('sha256', this.API_SECRET)
      .update(new TextEncoder().encode(finalStr))
      .digest('hex');
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    return Array.from({ length: Math.ceil(array.length / chunkSize) }, (_, i) =>
      array.slice(i * chunkSize, i * chunkSize + chunkSize)
    );
  }

  private getCsvFilePath(): string {
    const now = new Date();
    const fileName = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(
      now.getHours()
    ).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-ACS.csv`;
    return path.join(this.REPORTS_DIR, fileName);
  }

  private async getUsersNftMultipliers(
    userAddresses: string[]
  ): Promise<{ [address: string]: number }> {
    const multipliers: { [address: string]: number } = {};
    userAddresses.forEach((addr) => (multipliers[addr] = 1));

    const batches = this.chunkArray(userAddresses, this.BATCH_SIZE);
    for (const batch of batches) {
      const multicall = new Multicall({
        nodeUrl: 'https://rpc.soneium.org/',
        tryAggregate: true,
        multicallCustomContractAddress:
          '0xcA11bde05977b3631167028862bE2a173976CA11',
      });

      const callContexts = this.NFT_MULTIPLIERS.map((nft) => ({
        reference: nft.address,
        contractAddress: nft.address,
        abi: this.ERC721_ABI,
        calls: batch.map((address) => ({
          reference: address,
          methodName: 'balanceOf',
          methodParameters: [address],
        })),
      }));

      const results = await multicall.call(callContexts);

      for (const nft of this.NFT_MULTIPLIERS) {
        const contractResult = results.results[nft.address];
        contractResult.callsReturnContext.forEach((callReturn, index) => {
          const balance =
            callReturn.returnValues[callReturn.returnValues.length - 1];
          if (+balance > 0) {
            const userAddress = batch[index];
            multipliers[userAddress] = Math.max(
              multipliers[userAddress],
              nft.multiplier
            );
          }
        });
      }
    }
    return multipliers;
  }

  async distributeAcs(): Promise<void> {
    await this.updateAcsPoolFromGraphQL();
    const users = await this.userService.getUsersWithPoints();
    if (users.length === 0) {
      this.logger.warn('Нет пользователей для распределения ACS.');
      return;
    }

    const userAddresses = users.map((user) => user.address);
    const multipliers = await this.getUsersNftMultipliers(userAddresses);

    const usersWithEffectivePoints = users.map((user) => {
      const multiplier = multipliers[user.address] || 1;
      const effectivePoints = user.points * multiplier;
      return { ...user, effectivePoints };
    });

    const totalEffectivePoints = usersWithEffectivePoints.reduce(
      (sum, user) => sum + user.effectivePoints,
      0
    );
    if (totalEffectivePoints === 0) {
      this.logger.warn(
        'Общее количество эффективных поинтов = 0, распределение ACS невозможно.'
      );
      return;
    }

    const acsItems: AcsDistributionItem[] = usersWithEffectivePoints
      .map((user) => ({
        userAddress: Web3.utils.toChecksumAddress(user.address),
        defiId: this.DEFI_ID,
        acsAmount: Math.floor(
          (user.effectivePoints / totalEffectivePoints) * this.ACS_POOL
        ),
        description: 'Arkada ACS allocation',
      }))
      .filter((item) => item.acsAmount > 0);
    const batches = this.chunkArray(acsItems, this.BATCH_SIZE);
    const csvFilePath = this.getCsvFilePath();
    const csvStream = stringify({
      header: true,
      columns: ['User Address', 'ACS Points'],
    });
    const writableStream = fs.createWriteStream(csvFilePath);
    csvStream.pipe(writableStream);

    for (const batch of batches) {
      const timestamp = Date.now();
      const nonce = this.generateNonce();
      const signature = this.generateSignature(batch, timestamp, nonce);

      try {
        const res = await axios.post(this.ACS_API_URL, batch, {
          headers: {
            'x-timestamp': timestamp.toString(),
            'x-signature': signature,
            'x-nonce': nonce,
            'Content-Type': 'application/json',
          },
        });

        this.logger.log(
          `ACS успешно отправлены для ${batch.length} пользователей.`
        );
        batch.forEach((user) => {
          csvStream.write([user.userAddress, user.acsAmount]);
        });
      } catch (error) {
        if (error.response) {
          this.logger.error(
            `Ошибка при отправке ACS: ${error.response.status
            } - ${JSON.stringify(error.response.data)}`
          );
          console.error('🔴 Полный ответ ошибки:', error.response.data);
        } else if (error.request) {
          this.logger.error(
            '🔴 Запрос был отправлен, но ответа нет:',
            error.request
          );
          console.error(
            '🔴 Запрос был отправлен, но ответа нет:',
            error.request
          );
        } else {
          this.logger.error(`🔴 Ошибка при отправке запроса: ${error.message}`);
          console.error(`🔴 Ошибка при отправке запроса: ${error.message}`);
        }
      }
    }

    csvStream.end();
    this.logger.log(`Распределение ACS завершено. CSV файл: ${csvFilePath}`);
  }
}
