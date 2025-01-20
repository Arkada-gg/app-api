import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  providers: [ConfigService],
  exports: [ConfigService],
  imports: [ConfigModule.forRoot()],
})
export class _ConfigModule {}
