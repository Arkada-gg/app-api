import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { AlchemyWebhookProcessor } from './alchemy-webhook.processor';
import { AlchemyCommonModule } from '../alchemy/alchemy-common.module';
import { Queue, QueueEvents } from 'bullmq';

@Module({
  imports: [
    AlchemyCommonModule,
    BullModule.registerQueue({
      name: 'alchemy-webhooks',
      connection: {
        host: process.env.REDIS_HOST,
        port: +process.env.REDIS_PORT,
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD,
        tls: {
          rejectUnauthorized: false
        },
      },
    }),
  ],
  providers: [AlchemyWebhookProcessor],
  exports: [BullModule],
})
export class AlchemyQueueModule implements OnModuleInit {
  private readonly logger = new Logger(AlchemyQueueModule.name);

  constructor(
    @InjectQueue('alchemy-webhooks') private alchemyQueue: Queue,
  ) { }

  onModuleInit() {
    const queueEvents = new QueueEvents('alchemy-webhooks', {
      connection: {
        host: process.env.REDIS_HOST,
        port: +process.env.REDIS_PORT,
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD,
        tls: {
          rejectUnauthorized: false,
        },
      },
    });

    queueEvents.on('waiting', ({ jobId }) => {
      this.logger.log(`Job ${jobId} is waiting`);
    });
    queueEvents.on('active', ({ jobId, prev }) => {
      this.logger.log(`Job ${jobId} is active; moved from status ${prev}`);
    });
    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      this.logger.log(`Job ${jobId} completed. Return value: ${JSON.stringify(returnvalue)}`);
    });
    queueEvents.on('failed', ({ jobId, failedReason }) => {
      this.logger.error(`Job ${jobId} failed. Reason: ${failedReason}`);
    });
    queueEvents.on('stalled', (jobId) => {
      this.logger.warn(`Job ${jobId} stalled and is now waiting again`);
    });
  }
}
