import { Module } from '@nestjs/common';
import { _ConfigModule } from './_config/config.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { S3Module } from './s3/s3.module';
import { UserModule } from './user/user.module';
import { CampaignModule } from './campaigns/campaign.module';
import { QuestModule } from './quests/quest.module';
import { PriceModule } from './price/price.module';
import { ScheduleModule } from '@nestjs/schedule';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { AscModule } from './asc/asc.module';
import { DiscordModule } from './discord/discord.module';
import { AlchemyModule } from './alchemy/alchemy.module';
import { IpfsModule } from './ipfs/ipfs.module';
import { HealthzModule } from './healthz/healthz.module';
import { SentryModule } from '@sentry/nestjs/setup';
import { TransactionsModule } from './transactions/transactions.module';
import { AlchemyQueueModule } from './queues/alchemy-queue.module';
@Module({
  imports: [
    SentryModule.forRoot(),
    ScheduleModule.forRoot(),
    DatabaseModule,
    _ConfigModule,
    AuthModule,
    S3Module,
    UserModule,
    CampaignModule,
    QuestModule,
    PriceModule,
    LeaderboardModule,
    AscModule,
    DiscordModule,
    AlchemyModule,
    IpfsModule,
    HealthzModule,
    TransactionsModule,
    AlchemyQueueModule
  ],
})
export class AppModule { }
