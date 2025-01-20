import { Module } from '@nestjs/common';
import { _ConfigModule } from './_config/config.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { S3Module } from './s3/s3.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [DatabaseModule, _ConfigModule, AuthModule, S3Module, UserModule],
})
export class AppModule {}
