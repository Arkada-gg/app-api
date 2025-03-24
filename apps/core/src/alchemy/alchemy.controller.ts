import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AlchemyWebhooksService } from './alchemy.service';
import { EventSignature } from './config/signatures';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Controller('alchemy')
export class AlchemyWebhooksController {
  private readonly logger = new Logger(AlchemyWebhooksController.name);

  constructor(
    private readonly alchemyWebhooksService: AlchemyWebhooksService,
    @InjectQueue('alchemy-webhooks')
    private readonly alchemyQueue: Queue,
  ) { }

  @Post('daily-check')
  @HttpCode(200)
  async handleWebhook(
    @Headers('x-alchemy-signature') signature: string,
    @Body() webhookEvent: any,
  ) {
    const startTime = Date.now();

    const isValid = await this.alchemyWebhooksService.verifyWebhookSignature(
      signature,
      JSON.stringify(webhookEvent),
      EventSignature.DAILY_CHECK
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    await this.alchemyQueue.add('daily-check-job',
      {
        eventSignature: EventSignature.DAILY_CHECK,
        webhookEvent,
      },
      { removeOnComplete: true }
    );

    const endTime = Date.now();
    this.logger.log(`handleWebhook(daily-check) queued. latency: ${endTime - startTime}ms`);

    return { message: 'Webhook queued successfully' };
  }

  @Post('pyramid-claim')
  @HttpCode(200)
  async handleWebhookMint(
    @Headers('x-alchemy-signature') signature: string,
    @Body() webhookEvent: any,
  ) {
    console.log('------>', JSON.stringify(webhookEvent));
    const startTime = Date.now();
    console.log('------>', `webhookEvent started at ${startTime}`);

    const isValid = await this.alchemyWebhooksService.verifyWebhookSignature(
      signature,
      JSON.stringify(webhookEvent),
      EventSignature.PYRAMID_CLAIM
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    await this.alchemyQueue.add('pyramid-claim-job',
      {
        eventSignature: EventSignature.PYRAMID_CLAIM,
        webhookEvent,
      },
      { removeOnComplete: true }
    );

    const endTime = Date.now();
    this.logger.log(`handleWebhook(pyramid-claim) queued. latency: ${endTime - startTime}ms`);

    return { message: 'Webhook queued successfully' };
  }
}
