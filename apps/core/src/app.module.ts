import { Module } from '@nestjs/common';
import { _ConfigModule } from './_config/config.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [DatabaseModule, _ConfigModule, AuthModule],
})
export class AppModule {}
