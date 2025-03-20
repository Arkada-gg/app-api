import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Interface, LogDescription, ethers } from 'ethers';
import { ConfigService } from '../_config/config.service';
import { QuestService } from '../quests/quest.service';
import { PyramidType } from '../shared/interfaces';
import { TransactionsService } from '../transactions/transactions.service';
import { UserService } from '../user/user.service';
import * as daylyCheckAbi from './abis/daily-check-abi.json';
import * as pyramidAbi from './abis/pyramid-abi.json';
import { CHAIN_ID_BY_ALCHEMY_CHAIN } from './config/chain';
import { EventSignature } from './config/signatures';

export interface AlchemyWebhookEvent {
  id: string;
  createdAt: string;
  type: string;
  event: any;
}
export interface IEventComb {
  hash: string;
  event: LogDescription;
  contractAddress: string;
  blockNumber: number;
}

@Injectable()
export class AlchemyWebhooksService {
  private readonly logger = new Logger(AlchemyWebhooksService.name);

  constructor(
    private readonly userService: UserService,
    private readonly transactionsService: TransactionsService,
    private readonly questService: QuestService,
    private readonly configService: ConfigService
  ) {}

  private getSigningKeyByEventSignature(eventSignature: EventSignature) {
    switch (eventSignature) {
      case EventSignature.DAILY_CHECK:
        return this.configService.getOrThrow('ALCHEMY_SIGNING_KEY_DAILY_CHECK');
      case EventSignature.PYRAMID_CLAIM:
        return this.configService.getOrThrow(
          'ALCHEMY_SIGNING_KEY_PYRAMID_CLAIM'
        );
      default:
        throw new BadRequestException('Unsupported event signature');
    }
  }

  async verifyWebhookSignature(
    signature: string,
    rawBody: string,
    eventSignature: EventSignature
  ): Promise<boolean> {
    try {
      const signingKey = this.getSigningKeyByEventSignature(eventSignature);

      const hmac = crypto.createHmac('sha256', signingKey);
      const computedSignature = hmac.update(rawBody).digest('hex');
      return signature === computedSignature;
    } catch (error) {
      this.logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  async handleWebhookEvent(
    event: AlchemyWebhookEvent,
    signature: EventSignature
  ): Promise<void> {
    this.logger.log(`Processing webhook event id: ${event.id}`);

    try {
      switch (event.type) {
        case 'GRAPHQL':
          await this.handleGraphQl(event.event, signature);
          break;
        default:
          this.logger.warn(`Unhandled webhook event type: ${event.type}`);
          throw new BadRequestException('Unhandled webhook event type');
      }
    } catch (error) {
      this.logger.error('Error processing webhook event:', error);
      throw error;
    }
  }

  private getInterfaceByEventSignature(
    eventSignature: EventSignature
  ): Interface {
    switch (eventSignature) {
      case EventSignature.DAILY_CHECK:
        return new ethers.Interface(daylyCheckAbi);
      case EventSignature.PYRAMID_CLAIM:
        return new ethers.Interface(pyramidAbi);
      default:
        throw new BadRequestException('Unsupported event signature');
    }
  }

  private async handleGraphQl(
    event: any,
    signature: EventSignature
  ): Promise<string> {
    const chainId = CHAIN_ID_BY_ALCHEMY_CHAIN[event.network];

    const decodedLogs = this.validateAndDecodeLogs(
      event.data.block.logs,
      this.getInterfaceByEventSignature(signature),
      event.data.block.number
    );

    const supportedEvents = this.filterEventsBySupported(decodedLogs, [
      signature,
    ]);

    if (supportedEvents.length === 0)
      throw new InternalServerErrorException('No supported events');

    const filteredEvents = await this.checkAndRecordTransactions(
      supportedEvents
    );

    const updatingRes = await Promise.allSettled(
      filteredEvents.map((event) =>
        this.operateEventDependsOnSignature(event, signature, chainId)
      )
    );

    const rejectedRes = updatingRes.filter(
      (settle) => settle.status === 'rejected'
    ) as PromiseRejectedResult[];

    if (rejectedRes.length > 0) {
      this.logger.error('Error handling event:', rejectedRes);
      throw new InternalServerErrorException('Some events not operated');
    }
    return 'OK';
  }

  private validateAndDecodeLogs(
    logs: any[],
    intface: Interface,
    blockNumber: number
  ) {
    try {
      if (!Array.isArray(logs)) {
        throw new InternalServerErrorException('Invalid logs format');
      }

      const transformedLogs = logs.map((log) => {
        return {
          txHash: log.transaction.hash,
          topics: log.topics,
          data: log.data,
          address: log.account.address,
        };
      });

      return transformedLogs
        .map<IEventComb | null>((log) => {
          try {
            return {
              hash: log.txHash.toLowerCase(),
              event: intface.parseLog(log),
              contractAddress: log.address,
              blockNumber,
            };
          } catch (error) {
            this.logger.error('Error parsing log:', error.message);
            return null;
          }
        })
        .filter((log) => log !== null) as IEventComb[];
    } catch (error) {
      this.logger.error('Error validating and decoding logs:', error);
      throw new InternalServerErrorException(error);
    }
  }

  private filterEventsBySupported(
    events: IEventComb[],
    signatures: EventSignature[]
  ) {
    return events.filter((event) => {
      return signatures.includes(event.event.signature as EventSignature);
    });
  }

  private async operateEventDependsOnSignature(
    event: IEventComb,
    signature: EventSignature,
    chainId: number
  ) {
    switch (signature) {
      case EventSignature.DAILY_CHECK:
        return this.handleDailyCheckEvent(event);
      case EventSignature.PYRAMID_CLAIM:
        return this.handlePyramidClaimEvent(event, chainId);
      default:
        throw new BadRequestException('Unsupported event signature');
    }
  }

  private async checkAndRecordTransactions(events: IEventComb[]) {
    const res = await Promise.allSettled(
      events.map(async (eventComb) => {
        const existedTx = await this.transactionsService.findByHash(
          eventComb.hash
        );

        if (existedTx) throw new Error('Tx already exist');

        await this.transactionsService.createTx({
          hash: eventComb.hash,
          event_name: eventComb.event.name,
          block_number: eventComb.blockNumber,
          args: eventComb.event.args,
        });

        return eventComb;
      })
    );

    const fulfilledRes = res.filter(
      (settle) => settle.status === 'fulfilled'
    ) as PromiseFulfilledResult<IEventComb>[];
    return fulfilledRes.map((settle) => settle.value);
  }

  private async handleDailyCheckEvent(event: IEventComb) {
    try {
      const { caller, streak, timestamp } = event.event.args;
      this.logger.debug(
        `DailyCheck fired: caller=${caller}, streak=${streak}, timestamp=${timestamp}`
      );
      const streakNum = Number(streak);
      const points = streakNum < 30 ? streakNum : 30;
      await this.userService.updatePoints(caller, points, 'daily');
      return event;
    } catch (error) {
      this.logger.error('Error handling daily check event:', error);
      throw new InternalServerErrorException(error);
    }
  }

  private async handlePyramidClaimEvent(event: IEventComb, chainId: number) {
    try {
      const { questId: campaignId, claimer: userAddress } = event.event.args;

      const campaign = await this.questService.completeCampaignAndAwardPoints(
        campaignId,
        userAddress,
        true
      );

      const campaignType =
        campaign.type === 'basic' ? PyramidType.BASIC : PyramidType.GOLD;

      await this.userService.incrementPyramid(
        userAddress,
        campaignType,
        chainId
      );

      return event;
    } catch (error) {
      this.logger.error('Error handling pyramid claim event:', error);
      throw new InternalServerErrorException(error);
    }
  }
}
