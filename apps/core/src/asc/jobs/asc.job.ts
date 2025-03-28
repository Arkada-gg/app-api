import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AcsService } from '../asc.service';

@Injectable()
export class AcsJob {
  private readonly logger = new Logger(AcsJob.name);

  constructor(private readonly acsService: AcsService) {}

  @Cron('0 1,13 * * *')
  // @Cron(CronExpression.EVERY_30_SECONDS)
  async handleAcsDistribution() {
    this.logger.log('Запуск джобы распределения ACS...');

    try {
      await this.acsService.distributeAcs();
      this.logger.log('Распределение ACS завершено.');
    } catch (error) {
      this.logger.error(`Ошибка в ACS джобе: ${error.message}`);
    }
  }
}
