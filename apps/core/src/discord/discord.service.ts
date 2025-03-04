import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Client, GatewayIntentBits, Guild, GuildMember } from 'discord.js';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DiscordBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordBotService.name);
  private discordClient: Client;

  constructor(private readonly dbService: DatabaseService) {}

  async onModuleInit() {
    this.discordClient = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
    });

    this.discordClient.once('ready', () => {
      this.logger.log(
        `Discord bot logged in as ${this.discordClient.user.tag}`
      );
    });

    this.discordClient.on('guildCreate', async (guild: Guild) => {
      this.logger.log(`Bot added to guild: ${guild.id} (${guild.name})`);
      try {
        const pgClient = await this.dbService.getClient();
        await pgClient.query(
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
      await this.discordClient.login(process.env.DISCORD_BOT_TOKEN3);
    } catch (error) {
      this.logger.error(`Discord bot login failed: ${error.message}`);
    }
  }

  async onModuleDestroy() {
    this.discordClient.destroy();
  }

  async isUserInGuildByUsername(
    guildId: string,
    username: string
  ): Promise<boolean> {
    try {
      const guild = await this.discordClient.guilds.fetch(guildId);
      const members = await guild.members.fetch();
      const member = members.find((m) => m.user.username === username);
      return !!member;
    } catch (error) {
      this.logger.error(
        `Error checking membership for username ${username} in guild ${guildId}: ${error.message}`
      );
      return false;
    }
  }

  async assignRoleToUser(
    guildId: string,
    discordId: string,
    roleName: string
  ): Promise<boolean> {
    try {
      const guild = await this.discordClient.guilds.fetch(guildId);
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
