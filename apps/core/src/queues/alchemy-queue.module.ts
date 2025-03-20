import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AlchemyWebhookProcessor } from './alchemy-webhook.processor';
import { AlchemyCommonModule } from '../alchemy/alchemy-common.module';

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
export class AlchemyQueueModule { }
