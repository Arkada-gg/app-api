import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { S3Module } from '../s3/s3.module';
import { QuestRepository } from '../quests/quest.repository';
import { TwitterScoreJob } from './jobs/twitter-scout.job';
import { TwitterScoreController } from './user-twitter.controller';
import { WalletScoreController } from './wallet-score.controller';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [S3Module, RedisModule],
  controllers: [UserController, TwitterScoreController, WalletScoreController],
  providers: [UserService, UserRepository, QuestRepository, TwitterScoreJob],
  exports: [UserService],
})
export class UserModule { }
