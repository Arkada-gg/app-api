import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private client: Client;

  constructor() {
    this.client = new Client({
      connectionString:
        process.env.DATABASE_URL ||
        'postgres://user:pass@localhost:5432/arkada_db',
    });
  }

  async onModuleInit() {
    await this.client.connect();
    await this.initializeSchema();
  }

  private async initializeSchema() {
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS users (
        address VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255),
        avatar VARCHAR(255),
        twitter VARCHAR(255),
        discord VARCHAR(255),
        telegram VARCHAR(255),
        github VARCHAR(255)
      );
    `);
  }

  getClient() {
    return this.client;
  }
}
