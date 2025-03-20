import {
  Controller,
  Get,
  Query,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import * as crypto from 'crypto';
import { stringify } from 'csv-stringify';
import { UserService } from '../user/user.service';

@ApiTags('ACS Simulation')
@Controller('acs-sim')
@Injectable()
export class AcsSimulationController {
  private readonly logger = new Logger(AcsSimulationController.name);
  private readonly REPORTS_DIR = path.join(__dirname, '..', '..', 'reports');
  private readonly BATCH_SIZE = 1000; // Лимит пользователей в батче
  private readonly DEFI_ID = 28; // ID проекта Arkada

  constructor(private readonly userService: UserService) {
    if (!fs.existsSync(this.REPORTS_DIR)) {
      fs.mkdirSync(this.REPORTS_DIR);
    }
  }

  private generateNonce(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateSignature(
    items: any[],
    timestamp: number,
    nonce: string,
    secret: string
  ): string {
    const signStr = items
      .map((item) =>
        Object.keys(item)
          .sort()
          .map((key) => `${key}=${(item as any)[key]}`)
          .join('&')
      )
      .join('&');

    const finalStr = `${signStr}&timestamp=${timestamp}&nonce=${nonce}`;
    return crypto.createHmac('sha256', secret).update(finalStr).digest('hex');
  }

  @Get('simulate')
  @ApiOperation({
    summary: '',
    description: '.',
  })
  @ApiQuery({
    name: 'acsPool',
    type: Number,
    required: false,
    example: 100000,
    description: '(100 000).',
  })
  @ApiResponse({
    status: 200,
    description: 'ACS данные сохранены в CSV',
  })
  async simulateAcsDistribution(
    @Query('acsPool') acsPoolParam?: number
  ): Promise<{ message: string; file: string }> {
    const ACS_POOL = acsPoolParam ?? 100000;
    this.logger.log(
      `Начало симуляции распределения ACS. ACS_POOL: ${ACS_POOL}`
    );

    const users = await this.userService.getUsersWithPoints();
    if (users.length === 0) {
      this.logger.warn('Нет пользователей для распределения ACS.');
      throw new BadRequestException('Нет пользователей для распределения ACS.');
    }

    const totalPoints = users.reduce((sum, user) => sum + user.points, 0);
    if (totalPoints === 0) {
      this.logger.warn(
        'Общее количество поинтов = 0, распределение невозможно.'
      );
      throw new BadRequestException('Нет поинтов для распределения.');
    }

    const acsItems = users.map((user) => ({
      userAddress: user.address,
      defiId: this.DEFI_ID,
      acsAmount: Math.floor((user.points / totalPoints) * ACS_POOL),
      description: 'Arkada ACS allocation',
    }));

    const timestamp = Date.now();
    const nonce = this.generateNonce();
    const secret = process.env.ACS_API_SECRET || 'default_secret';
    const signature = this.generateSignature(
      acsItems,
      timestamp,
      nonce,
      secret
    );

    const fileName = `${new Date()
      .toISOString()
      .slice(0, 10)}-acs-simulated-${ACS_POOL}.csv`;
    const filePath = path.join(this.REPORTS_DIR, fileName);

    const csvStream = stringify({
      header: true,
      columns: [
        'User Address',
        'ACS Points',
        'Timestamp',
        'Nonce',
        'Signature',
      ],
    });

    return new Promise((resolve, reject) => {
      const writableStream = fs.createWriteStream(filePath);
      csvStream.pipe(writableStream);

      acsItems.forEach((user) => {
        csvStream.write([
          user.userAddress,
          user.acsAmount,
          timestamp,
          nonce,
          signature,
        ]);
      });

      csvStream.end();

      writableStream.on('finish', () => {
        this.logger.log(`Симуляция завершена, файл сохранен: ${filePath}`);
        resolve({ message: 'ACS данные сохранены в CSV', file: fileName });
      });

      writableStream.on('error', reject);
    });
  }
}
