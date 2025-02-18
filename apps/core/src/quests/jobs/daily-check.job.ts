import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Web3 from 'web3';
import { UserService } from '../../user/user.service';

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
  private subscription: any;
  private reconnectTimer: NodeJS.Timeout | null = null;

  private readonly wsUrl = `wss://soneium.rpc.scs.startale.com?apikey=${process.env.STARTALE_API_KEY}`;
  private readonly contractAddress = process.env.DAILY_CHECK_ADDRESS;

  constructor(private readonly userService: UserService) {}

  onModuleInit() {
    this.connectAndSubscribe();
  }

  private connectAndSubscribe() {
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

      this.subscription = this.contract.events.DailyCheck();

      this.subscription.on('connected', (subscriptionId: string) => {
        this.logger.log(
          `DailyCheck subscription connected, ID: ${subscriptionId}`
        );
      });

      this.subscription.on('data', async (event) => {
        const { caller, streak, timestamp } = event.returnValues as any;
        this.logger.debug(
          `DailyCheck fired: caller=${caller}, streak=${streak}, timestamp=${timestamp}`
        );

        const streakNum = Number(streak);
        const points = streakNum < 30 ? streakNum : 30;

        try {
          await this.userService.updatePoints(caller, points, 'daily');
          this.logger.log(
            `DailyCheck: user=${caller}, streak=${streakNum}, awarded=${points} daily pts`
          );
        } catch (err) {
          this.logger.error(
            `Ошибка при начислении очков: ${(err as Error).message}`
          );
        }
      });
      this.subscription.on('error', (err: any) => {
        this.logger.error(`Subscription error: ${err.message}`);
        this.handleCloseOrError();
      });

      this.logger.log(`connectAndSubscribe finished (attempt).`);
    } catch (error) {
      this.logger.error(`Failed to subscribe: ${error.message}`);
      this.scheduleReconnect();
    }
  }

  private handleCloseOrError() {
    this.logger.warn('Will try to reconnect in 5 seconds...');
    try {
      if (this.subscription) {
        this.subscription.unsubscribe((err: any, success: boolean) => {
          if (success) {
            this.logger.log('Unsubscribed old subscription successfully.');
          }
          if (err) {
            this.logger.error(`Error unsubscribing: ${err.message}`);
          }
        });
      }
    } catch (e) {
      this.logger.error(`Error during unsubscribing: ${e.message}`);
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.connectAndSubscribe();
      }, 5000);
    }
  }
}
