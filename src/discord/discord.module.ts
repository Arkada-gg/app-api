import { Module } from '@nestjs/common';
import { DiscordBotService } from './discord.service';
import { DiscordController } from './discord.controller';
import { UserModule } from '../user/user.module';

@Module({
  providers: [DiscordBotService],
  exports: [DiscordBotService],
  imports: [UserModule],
  controllers: [DiscordController],
})
export class DiscordModule {}
