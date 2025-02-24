import { Controller, Get, Query } from '@nestjs/common';
import { DiscordBotService } from './discord.service';

@Controller('discord')
export class DiscordController {
  constructor(private readonly discordBotService: DiscordBotService) {}

  @Get('check-membership')
  async checkMembership(
    @Query('guildId') guildId: string,
    @Query('discordUsername') userId: string
  ): Promise<{ member: boolean }> {
    const isMember = await this.discordBotService.isUserInGuildByUsername(
      guildId,
      userId
    );
    return { member: isMember };
  }
}
