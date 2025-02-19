import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { stringify } from 'csv-stringify';
import { UserService } from '../user/user.service';
import Web3 from 'web3';

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
  private readonly DEFI_ID = 28;
  private readonly ACS_POOL = 1;
  private readonly ACS_API_URL =
    'https://test4.xzsean.eu.org/acs/addDiscretionaryPointsBatch';
  private readonly REPORTS_DIR = path.join(__dirname, '..', '..', 'reports');
  private readonly BATCH_SIZE = 1000;

  constructor(private readonly userService: UserService) {
    if (!fs.existsSync(this.REPORTS_DIR)) {
      fs.mkdirSync(this.REPORTS_DIR);
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
    console.log('------>', items);
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
      .update(Buffer.from(finalStr))
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

  async distributeAcs(): Promise<void> {
    const users = await this.userService.getUsersWithPoints();
    if (users.length === 0) {
      this.logger.warn('Нет пользователей для распределения ACS.');
      return;
    }

    const totalPoints = users.reduce((sum, user) => sum + user.points, 0);
    if (totalPoints === 0) {
      this.logger.warn(
        'Общее количество поинтов = 0, распределение ACS невозможно.'
      );
      return;
    }

    const acsItems: AcsDistributionItem[] = users.map((user) => ({
      userAddress: Web3.utils.toChecksumAddress(user.address),
      defiId: this.DEFI_ID,
      acsAmount: Math.floor((user.points / totalPoints) * this.ACS_POOL),
      description: 'Arkada ACS allocation',
    }));

    const batches = this.chunkArray(acsItems, this.BATCH_SIZE);
    const csvFilePath = this.getCsvFilePath();
    const csvStream = stringify({
      header: true,
      columns: ['User Address', 'ACS Points'],
    });
    const writableStream = fs.createWriteStream(csvFilePath);
    csvStream.pipe(writableStream);

    for (const batch of batches) {
      console.log('-batch----->', batch);
      const timestamp = Date.now();
      const nonce = this.generateNonce();
      const signature = this.generateSignature(batch, timestamp, nonce);

      try {
        console.log(
          'this.ACS_API_URL------>',
          this.ACS_API_URL,
          'x-timestamp--->',
          timestamp.toString(),
          '-x-signature-->',
          signature,
          'x-nonce---->',
          nonce
        );
        const res = await axios.post(this.ACS_API_URL, batch, {
          headers: {
            'x-timestamp': timestamp.toString(),
            'x-signature': signature,
            'x-nonce': nonce,
            'Content-Type': 'application/json',
          },
        });

        console.log('------>', res);

        this.logger.log(
          `ACS успешно отправлены для ${batch.length} пользователей.`
        );

        batch.forEach((user) => {
          csvStream.write([user.userAddress, user.acsAmount]);
        });
      } catch (error) {
        if (error.response) {
          // Ошибка с сервера ACS API
          this.logger.error(
            `Ошибка при отправке ACS: ${
              error.response.status
            } - ${JSON.stringify(error.response.data)}`
          );
          console.error('🔴 Полный ответ ошибки:', error.response.data);
        } else if (error.request) {
          // Запрос ушел, но не было ответа
          this.logger.error(
            '🔴 Запрос был отправлен, но ответа нет:',
            error.request
          );
          console.error(
            '🔴 Запрос был отправлен, но ответа нет:',
            error.request
          );
        } else {
          // Ошибка в процессе создания запроса
          this.logger.error(`🔴 Ошибка при отправке запроса: ${error.message}`);
          console.error(`🔴 Ошибка при отправке запроса: ${error.message}`);
        }
      }
    }

    csvStream.end();

    this.logger.log(`Распределение ACS завершено. CSV файл: ${csvFilePath}`);
  }
}
