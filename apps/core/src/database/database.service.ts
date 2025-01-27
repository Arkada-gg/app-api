import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Client } from 'pg';
import { ConfigService } from '../_config/config.service';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private client: Client;

  constructor(private readonly configService: ConfigService) {
    this.client = new Client({
      connectionString:
        this.configService.get('DATABASE_URL') ||
        'postgres://user:password@localhost:5432/arkada_db',
    });
  }

  async onModuleInit() {
    await this.client.connect();
    this.logger.log('Connected to PostgreSQL');
    await this.initializeSchema();
  }

  private async initializeSchema() {
    await this.client.query(`
    CREATE TABLE IF NOT EXISTS users (
      address BYTEA PRIMARY KEY,
      name VARCHAR(255),
      avatar VARCHAR(255),
      twitter VARCHAR(255),
      discord VARCHAR(255),
      telegram VARCHAR(255),
      github VARCHAR(255),
      email VARCHAR(255) UNIQUE,
      points INTEGER DEFAULT 0,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    );
    `);
  }

  getClient(): Client {
    return this.client;
  }
}
