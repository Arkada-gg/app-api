import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Web3 from 'web3';
import { UserService } from '../../user/user.service';
import {
  NewHeadsSubscription,
  LogsSubscription,
} from 'web3/lib/commonjs/eth.exports';
import { TransactionsService } from '../../transactions/transactions.service';

const dailyCheckABI = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'caller',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'streak',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'timestamp',
        type: 'uint256',
      },
    ],
    name: 'DailyCheck',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint8',
        name: 'version',
        type: 'uint8',
      },
    ],
    name: 'Initialized',
    type: 'event',
  },
  {
    inputs: [],
    name: 'check',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'checkDatas',
    outputs: [
      { internalType: 'uint256', name: 'streak', type: 'uint256' },
      { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_timespamp', type: 'uint256' }],
    name: 'getDaysCountByTs',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

@Injectable()
export class DailyCheckJob implements OnModuleInit {
  private readonly logger = new Logger(DailyCheckJob.name);
  private web3: Web3;
  private contract: any;
  private subscription: LogsSubscription;

  private receiveBlockTimestamp: number;
  private heartBeatTimer: NodeJS.Timeout | null = null;

  private blocksSubscription: NewHeadsSubscription;

  private reconnectTimer: NodeJS.Timeout | null = null;

  // private readonly wsUrl = `wss://soneium.rpc.scs.startale.com?apikey=${process.env.STARTALE_API_KEY}`;
  private readonly wsUrl = 'wss://soneium.gateway.tenderly.co';
  private readonly contractAddress = process.env.DAILY_CHECK_ADDRESS;

  constructor(
    private readonly userService: UserService,
    private readonly transactionsService: TransactionsService
  ) {}

  async onModuleInit() {
    this.connectAndSubscribe();
  }

  private async connectAndSubscribe() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      this.web3 = new Web3(this.wsUrl);
      this.contract = new this.web3.eth.Contract(
        dailyCheckABI,
        this.contractAddress
      );

      this.logger.log(
        `Trying to subscribe to "DailyCheck" on ${this.contractAddress}...`
      );

      this.subscription = await this.contract.events.DailyCheck();

      this.subscription.on('connected', (subscriptionId: string) => {
        this.logger.log(
          `DailyCheck subscription connected, ID: ${subscriptionId}`
        );
        this.startHeartbeat();
      });

      this.subscription.on('data', async (event) => {
        await this.handleDailyCheckEvent(event);
      });

      this.subscription.on('error', (err: any) => {
        this.logger.error(`Subscription error: ${err.message}`);
        this.handleCloseOrError();
      });

      this.logger.log(`connectAndSubscribe finished (attempt).`);
      this.fetchPastEvents();
    } catch (error) {
      this.logger.error(`Failed to subscribe: ${error.message}`);
      this.scheduleReconnect();
    }
  }

  private async fetchPastEvents() {
    try {
      const latestBlock = await this.web3.eth.getBlockNumber();
      const pastEvents = await this.contract.getPastEvents('DailyCheck', {
        fromBlock: Number(latestBlock) - 100, // Adjust range based on needs
        toBlock: 'latest',
      });
      const existedTransactions = await Promise.all(
        pastEvents.map((event) =>
          this.transactionsService.findByHash(event.transactionHash)
        )
      );

      await Promise.all(
        pastEvents.map(async (event, index) => {
          if (existedTransactions[index]) return;
          await this.handleDailyCheckEvent(event);
        })
      );
      this.logger.log(`Fetched ${pastEvents.length} past DailyCheck events.`);
    } catch (error) {
      this.logger.error(`Error fetching past events: ${error.message}`);
    }
  }

  private async handleDailyCheckEvent(event: any) {
    try {
      await this.transactionsService.createTx({
        hash: event.transactionHash,
        event_name: event.event,
        block_number: event.blockNumber,
        args: event.returnValues,
      });
      const { caller, streak, timestamp } = event.returnValues;
      this.logger.debug(
        `DailyCheck fired: caller=${caller}, streak=${streak}, timestamp=${timestamp}`
      );
      const streakNum = Number(streak);
      const points = streakNum < 30 ? streakNum : 30;
      await this.userService.updatePoints(caller, points, 'daily');
      this.logger.log(
        `DailyCheck: user=${caller}, streak=${streakNum}, awarded=${points} daily pts`
      );
    } catch (err) {
      this.logger.error(`Error handling event: ${(err as Error).message}`);
    }
  }

  private async handleCloseOrError() {
    this.logger.warn('Will try to reconnect in 5 seconds...');
    try {
      if (this.subscription) {
        await this.subscription.unsubscribe();
      }
      if (this.blocksSubscription) {
        await this.blocksSubscription.unsubscribe();
      }
    } catch (e) {
      this.logger.error(`Error during unsubscribing: ${e.message}`);
    }
    this.scheduleReconnect();
  }

  // Avoid the Websocket connection to go idle by subscribing to ‘newBlockHeaders’
  private async startHeartbeat() {
    this.logger.debug('Starting WebSocket heartbeat...');
    this.blocksSubscription = await this.web3.eth.subscribe('newBlockHeaders');
    this.logger.debug('WebSocket heartbeat started.');
    this.blocksSubscription.on('data', () => {
      this.receiveBlockTimestamp = Date.now();
    });

    this.heartBeatTimer = setInterval(() => {
      if (Date.now() - this.receiveBlockTimestamp > 20000) {
        clearInterval(this.heartBeatTimer);
        this.heartBeatTimer = null;

        return this.handleCloseOrError();
      }

      this.logger.debug('WebSocket heartbeat status: OK');
    }, 10000);
  }

  private scheduleReconnect() {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.connectAndSubscribe();
      }, 5000);
    }
  }
}
