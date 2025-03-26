import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Client, GatewayIntentBits, Guild } from 'discord.js';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DiscordBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordBotService.name);
  private discordClientArkada: Client;
  private discordClientOther: Client;

  constructor(private readonly dbService: DatabaseService) { }

  async onModuleInit() {
    this.discordClientArkada = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
    });

    this.discordClientOther = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
    });

    this.discordClientArkada.once('ready', () => {
      this.logger.log(
        `Discord bot logged in as ${this.discordClientArkada.user.tag}`
      );
    });

    this.discordClientOther.once('ready', () => {
      this.logger.log(
        `Discord bot logged in as ${this.discordClientOther.user.tag}`
      );
    });

    this.discordClientOther.on('guildCreate', async (guild: Guild) => {
      this.logger.log(`Bot added to guild: ${guild.id} (${guild.name})`);
      try {
        await this.dbService.query(
          `INSERT INTO discord_guilds (guild_id, project_id)
           VALUES ($1, $2)
           ON CONFLICT (guild_id) DO NOTHING`,
          [guild.id, guild.name]
        );
        this.logger.log(`Guild ${guild.id} saved in database`);
      } catch (error) {
        this.logger.error(`Error saving guild ${guild.id}: ${error.message}`);
      }
    });

    try {
      await this.discordClientArkada.login(process.env.DISCORD_BOT_TOKEN3);
      await this.discordClientOther.login(process.env.DISCORD_BOT_TOKEN4);
    } catch (error) {
      this.logger.error(`Discord bot login failed: ${error.message}`);
    }
  }

  async onModuleDestroy() {
    this.discordClientArkada.destroy();
  }

  async isUserInGuildByUsername(
    guildId: string,
    username: string
  ): Promise<{ success: boolean }> {
    try {
      const guild = await this.discordClientOther.guilds.fetch(guildId);
      const members = await guild.members.fetch();

      const member = members.find((m) => m.user.username === username);
      return { success: !!member }
    } catch (error) {
      this.logger.error(
        `Error checking membership for username ${username} in guild ${guildId}: ${error.message}`
      );
      return { success: false }
    }
  }

  async assignRoleToUser(
    guildId: string,
    discordId: string,
    roleName: string
  ): Promise<boolean> {
    try {
      const guild = await this.discordClientArkada.guilds.fetch(guildId);
      const members = await guild.members.fetch();

      if (!guild) {
        this.logger.error(`Guild with ID ${guildId} not found`);
        return false;
      }
      const member = members.find((m) => m.user.username === discordId);

      if (!member) {
        this.logger.error(
          `Member with ID ${discordId} not found in guild ${guildId}`
        );
        return false;
      }

      const role = guild.roles.cache.find((r) => r.name === roleName);
      if (!role) {
        this.logger.error(`Role ${roleName} not found in guild ${guildId}`);
        return false;
      }

      await member.roles.add(role);
      this.logger.log(
        `Role ${roleName} assigned to user ${discordId} in guild ${guildId}`
      );
      return true;
    } catch (error) {
      this.logger.error(`assignRoleToUser error: ${error.message}`);
      return false;
    }
  }
}
