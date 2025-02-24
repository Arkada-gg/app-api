import { Module } from '@nestjs/common';
import { DiscordBotService } from './discord.service';
import { DiscordController } from './discord.controller';

@Module({
  providers: [DiscordBotService],
  exports: [DiscordBotService],
  controllers: [DiscordController],
})
export class DiscordModule {}
