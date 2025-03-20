import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Client, ClientBase, Pool, PoolClient } from 'pg';
import { ConfigService } from '../_config/config.service';


export type RaiiPoolClient = PoolClient & {[Symbol.asyncDispose](): Promise<void>};

export type QueryFunction = Pick<ClientBase, "query">['query']

export type QueryClient = {query: QueryFunction}

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  private client: Client;
  private pool: Pool;

  constructor(private readonly configService: ConfigService) {
    this.pool = new Pool({
      max: 25, //TODO: env
      connectionString:
        this.configService.get('DATABASE_URL') ||
        'postgres://user:password@localhost:5432/arkada_db',
    });
  }

  private async initializeSchema() {
    await this.client.query(`
    CREATE TABLE IF NOT EXISTS users (
      address VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) UNIQUE,
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


  private makeRaiiPoolClient(client: PoolClient): RaiiPoolClient {
    client[Symbol.asyncDispose] = () =>  client.release();
    return client as RaiiPoolClient;
  }

  async getClient(): Promise<RaiiPoolClient> {
    const client = await this.pool.connect();
    return this.makeRaiiPoolClient(client);
  }
}
