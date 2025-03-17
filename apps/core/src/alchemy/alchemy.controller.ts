import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AlchemyWebhooksService } from './alchemy.service';
import { EventSignature } from './config/signatures';

@Controller('alchemy')
export class AlchemyWebhooksController {
  constructor(
    private readonly alchemyWebhooksService: AlchemyWebhooksService
  ) {}

  @Post('daily-check')
  @HttpCode(200)
  async handleWebhook(
    @Headers('x-alchemy-signature') signature: string,
    @Body() webhookEvent: any
  ) {
    // Verify the webhook signature
    const isValid = await this.alchemyWebhooksService.verifyWebhookSignature(
      signature,
      JSON.stringify(webhookEvent),
      EventSignature.DAILY_CHECK
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // Process the webhook event
    await this.alchemyWebhooksService.handleWebhookEvent(
      webhookEvent,
      EventSignature.DAILY_CHECK
    );

    return { message: 'Webhook processed successfully' };
  }

  @Post('pyramid-claim')
  @HttpCode(200)
  async handleWebhookMint(
    @Headers('x-alchemy-signature') signature: string,
    @Body() webhookEvent: any
  ) {
    // Verify the webhook signature
    const isValid = await this.alchemyWebhooksService.verifyWebhookSignature(
      signature,
      JSON.stringify(webhookEvent),
      EventSignature.PYRAMID_CLAIM
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // Process the webhook event
    await this.alchemyWebhooksService.handleWebhookEvent(
      webhookEvent,
      EventSignature.PYRAMID_CLAIM
    );

    return { message: 'Webhook processed successfully' };
  }
}
