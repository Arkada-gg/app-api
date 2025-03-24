import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, PoolClient, QueryResult } from 'pg';
import { ConfigService } from '../_config/config.service';
import { randomUUID } from 'node:crypto';

export type RaiiPoolClient = PoolClient & { [Symbol.asyncDispose](): Promise<void> };



@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  constructor(private readonly configService: ConfigService) {
    this.pool = new Pool({
      connectionString: this.configService.get('DATABASE_URL') ||
        'postgres://user:password@localhost:5432/arkada_db',
      max: 25
    });
  }

  async onModuleInit(): Promise<void> {
    await using client = await this.getClient();
    this.logger.log('Connected to PostgreSQL');
    return this.initializeSchema(client);
  }

  onModuleDestroy(): Promise<void> {
    return this.pool.end()
}


  private async initializeSchema(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users
      (
        address    VARCHAR(255) PRIMARY KEY,
        name       VARCHAR(255) UNIQUE,
        avatar     VARCHAR(255),
        twitter    VARCHAR(255),
        discord    VARCHAR(255),
        telegram   VARCHAR(255),
        github     VARCHAR(255),
        email      VARCHAR(255) UNIQUE,
        points     INTEGER                     DEFAULT 0,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      );
    `);
  }


  private makeRaiiPoolClient(client: PoolClient): RaiiPoolClient {
    client[Symbol.asyncDispose] = () => {
      client.release()
      this.logger.log('free connection: ', client['id'])
    };
    return client as RaiiPoolClient;
  }

  async getClient(): Promise<RaiiPoolClient> {
    const client = await this.pool.connect();
    client['id'] = randomUUID();
    this.logger.log('take connection: ', client['id'])
    return this.makeRaiiPoolClient(client);
  }

  async query<R = any>(text: string, params?: unknown[]): Promise<QueryResult<R>> {
    const start = performance.now();
    const res = await this.pool.query<R>(text, params);
    const duration = performance.now() - start;
    this.logger.log('executed query', {text, duration, rows: res.rowCount})
    const {totalCount, waitingCount, idleCount} = this.pool
    this.logger.log('pool stats:', {totalCount, waitingCount, idleCount})
    return res;
  }
}
