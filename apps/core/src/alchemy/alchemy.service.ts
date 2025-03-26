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
import { ALCHEMY_CHAIN, CHAIN_ID_BY_ALCHEMY_CHAIN } from './config/chain';
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
  ) { }

  async verifyWebhookSignature(
    signature: string,
    rawBody: string,
    eventSignature: EventSignature,
    network: ALCHEMY_CHAIN
  ): Promise<boolean> {
    const start = Date.now();
    try {
      const signingKey = this.getSigningKeyByEventSignature(eventSignature, network);

      const hmac = crypto.createHmac('sha256', signingKey);
      const computedSignature = hmac.update(rawBody).digest('hex');
      return signature === computedSignature;
    } catch (error) {
      this.logger.error('Error verifying webhook signature:', error);
      return false;
    } finally {
      const end = Date.now();
      this.logger.log(`verifyWebhookSignature took ${end - start}ms`);
    }
  }

  private getSigningKeyByEventSignature(eventSignature: EventSignature, network: ALCHEMY_CHAIN) {
    const start = Date.now();
    const chainId = CHAIN_ID_BY_ALCHEMY_CHAIN[network]
    if (!chainId) throw new BadRequestException("Invalid network provided")
    try {
      switch (eventSignature) {
        case EventSignature.DAILY_CHECK:
          return this.configService.getOrThrow(`ALCHEMY_SIGNING_KEY_DAILY_CHECK`);
        case EventSignature.PYRAMID_CLAIM:
          return this.configService.getOrThrow(`ALCHEMY_SIGNING_KEY_PYRAMID_CLAIM_${chainId}`);
        default:
          throw new BadRequestException('Unsupported event signature');
      }
    } finally {
      const end = Date.now();
      this.logger.debug(`getSigningKeyByEventSignature took ${end - start}ms`);
    }
  }

  async handleWebhookEvent(
    event: AlchemyWebhookEvent,
    signature: EventSignature
  ): Promise<void> {
    const start = Date.now();
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
    } finally {
      const end = Date.now();
      this.logger.log(`handleWebhookEvent took ${end - start}ms`);
    }
  }

  private async handleGraphQl(event: any, signature: EventSignature): Promise<string> {
    const start = Date.now();
    try {
      const chainId = CHAIN_ID_BY_ALCHEMY_CHAIN[event.network];

      const decodedLogs = this.validateAndDecodeLogs(
        event.data.block.logs,
        this.getInterfaceByEventSignature(signature),
        event.data.block.number
      );

      const supportedEvents = this.filterEventsBySupported(decodedLogs, [signature]);
      if (supportedEvents.length === 0) {
        throw new BadRequestException('No supported events');
      }

      const filteredEvents = await this.checkAndRecordTransactions(supportedEvents, chainId);
      const updatingRes = await Promise.allSettled(
        filteredEvents.map((evt) => this.operateEventDependsOnSignature(evt, signature, chainId))
      );

      const rejectedRes = updatingRes.filter((x) => x.status === 'rejected') as PromiseRejectedResult[];
      if (rejectedRes.length > 0) {
        for (const rej of rejectedRes) {
          const err = rej.reason;
          this.logger.error(`Rejected error name: ${err.name}`);
          this.logger.error(`Rejected error message: ${err.message}`);
          this.logger.error(`Rejected error stack: ${err.stack}`);
        }

        throw new InternalServerErrorException('Some events not operated');
      }
      return 'OK';
    } finally {
      const end = Date.now();
      this.logger.log(`handleGraphQl took ${end - start}ms`);
    }
  }

  private validateAndDecodeLogs(logs: any[], intface: Interface, blockNumber: number) {
    const start = Date.now();
    try {
      if (!Array.isArray(logs)) {
        throw new InternalServerErrorException('Invalid logs format');
      }
      const transformedLogs = logs.map((log) => ({
        txHash: log.transaction.hash,
        topics: log.topics,
        data: log.data,
        address: log.account.address,
      }));

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
        .filter((x) => x !== null) as IEventComb[];
    } finally {
      const end = Date.now();
      this.logger.debug(`validateAndDecodeLogs took ${end - start}ms`);
    }
  }

  private filterEventsBySupported(events: IEventComb[], signatures: EventSignature[]) {
    const start = Date.now();
    try {
      return events.filter((evt) => signatures.includes(evt.event.signature as EventSignature));
    } finally {
      const end = Date.now();
      this.logger.debug(`filterEventsBySupported took ${end - start}ms`);
    }
  }

  private async checkAndRecordTransactions(events: IEventComb[], chainId: number) {
    const start = Date.now();
    try {
      const res = await Promise.allSettled(
        events.map(async (evt) => {
          const existedTx = await this.transactionsService.findByHashAndChainId(evt.hash, chainId);
          if (existedTx) throw new Error('Tx already exist');

          await this.transactionsService.createTx({
            hash: evt.hash,
            event_name: evt.event.name,
            block_number: evt.blockNumber,
            args: evt.event.args,
            chain_id: chainId
          });

          return evt;
        })
      );

      const fulfilledRes = res.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<IEventComb>[];
      return fulfilledRes.map((r) => r.value);
    } finally {
      const end = Date.now();
      this.logger.debug(`checkAndRecordTransactions took ${end - start}ms`);
    }
  }

  private async operateEventDependsOnSignature(evt: IEventComb, signature: EventSignature, chainId: number) {
    const start = Date.now();
    try {
      switch (signature) {
        case EventSignature.DAILY_CHECK:
          return this.handleDailyCheckEvent(evt);
        case EventSignature.PYRAMID_CLAIM:
          return this.handlePyramidClaimEvent(evt, chainId);
        default:
          throw new BadRequestException('Unsupported event signature');
      }
    } finally {
      const end = Date.now();
      this.logger.debug(`operateEventDependsOnSignature took ${end - start}ms`);
    }
  }

  private async handleDailyCheckEvent(evt: IEventComb) {
    const start = Date.now();
    try {
      const { caller, streak, timestamp } = evt.event.args;
      this.logger.debug(`DailyCheck fired: caller=${caller}, streak=${streak}, timestamp=${timestamp}`);
      const streakNum = Number(streak);
      const points = streakNum < 30 ? streakNum : 30;
      await this.userService.updatePoints(caller, points, 'daily');
      return evt;
    } finally {
      const end = Date.now();
      this.logger.debug(`handleDailyCheckEvent took ${end - start}ms`);
    }
  }

  private async handlePyramidClaimEvent(evt: IEventComb, chainId: number) {
    const start = Date.now();
    try {
      const { questId: campaignId, claimer: userAddress } = evt.event.args;
      const campaign = await this.questService.completeCampaignAndAwardPoints(
        campaignId,
        userAddress,
        true
      );
      const campaignType = campaign.type === 'basic' ? PyramidType.BASIC : PyramidType.GOLD;
      await this.userService.incrementPyramid(userAddress, campaignType, chainId);

      return evt;
    } finally {
      const end = Date.now();
      this.logger.debug(`handlePyramidClaimEvent took ${end - start}ms`);
    }
  }

  private getInterfaceByEventSignature(eventSignature: EventSignature): Interface {
    const start = Date.now();
    try {
      switch (eventSignature) {
        case EventSignature.DAILY_CHECK:
          return new ethers.Interface(daylyCheckAbi);
        case EventSignature.PYRAMID_CLAIM:
          return new ethers.Interface(pyramidAbi);
        default:
          throw new BadRequestException('Unsupported event signature');
      }
    } finally {
      const end = Date.now();
      this.logger.debug(`getInterfaceByEventSignature took ${end - start}ms`);
    }
  }
}
