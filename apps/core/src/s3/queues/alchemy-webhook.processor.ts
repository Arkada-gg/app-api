import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, MetricsTime } from 'bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { AlchemyWebhooksService } from '../../alchemy/alchemy.service';

@Processor('alchemy-webhooks', {
  concurrency: 1, metrics: {
    maxDataPoints: MetricsTime.ONE_WEEK * 2,
  },
})
@Injectable()
export class AlchemyWebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(AlchemyWebhookProcessor.name);

  constructor(private readonly alchemyWebhooksService: AlchemyWebhooksService) {
    super();
  }

  async process(job: Job<any>): Promise<void> {
    const { eventSignature, webhookEvent } = job.data || {};

    this.logger.log(
      `Start job ${job.id}, signature=${eventSignature}`
    );

    try {
      await this.alchemyWebhooksService.handleWebhookEvent(
        webhookEvent,
        eventSignature
      );

      this.logger.log(`Job ${job.id} completed successfully`);
    } catch (err) {
      this.logger.error(`Job ${job.id} failed: ${err}`);
      throw err;
    }
  }
}
