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

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    _ConfigModule,
    AuthModule,
    S3Module,
    UserModule,
    CampaignModule,
    QuestModule,
    PriceModule,
  ],
})
export class AppModule {}
