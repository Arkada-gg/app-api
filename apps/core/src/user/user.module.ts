import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { S3Module } from '../s3/s3.module';
import { QuestRepository } from '../quests/quest.repository';
import { TwitterScoreJob } from './jobs/twitter-scout.job';
import { TwitterScoreController } from './user-twitter.controller';
import { WalletScoreJob } from './jobs/wallet-score';

@Module({
  imports: [S3Module],
  controllers: [UserController, TwitterScoreController],
  providers: [UserService, UserRepository, QuestRepository, TwitterScoreJob, WalletScoreJob],
  exports: [UserService],
})
export class UserModule {}
