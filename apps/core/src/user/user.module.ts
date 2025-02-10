import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { S3Module } from '../s3/s3.module';
import { QuestRepository } from '../quests/quest.repository';

@Module({
  imports: [S3Module],
  controllers: [UserController],
  providers: [UserService, UserRepository, QuestRepository],
  exports: [UserService],
})
export class UserModule {}
