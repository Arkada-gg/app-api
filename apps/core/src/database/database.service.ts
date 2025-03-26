import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, PoolClient, QueryResult } from 'pg';
import { ConfigService } from '../_config/config.service';
import * as Sentry from '@sentry/nestjs';

export type RaiiPoolClient = PoolClient & { [Symbol.asyncDispose](): Promise<void> };



@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;
  private poolRead: Pool;

  constructor(private readonly configService: ConfigService) {
    this.pool = this.configService.get('ENV') === "prod" ? new Pool({
      connectionString: this.configService.get('DATABASE_URL') ||
        'postgres://user:password@localhost:5432/arkada_db',
      max: +process.env.PG_MAX_CONNECTIONS || 10
    }) : new Pool({
      connectionString: this.configService.get('DATABASE_URL') || 'postgres://user:password@127.0.0.1:6432/arkada_db',
      max: 10
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await using client = await this.getClient();
      this.logger.log('Connected to PostgreSQL');
      return this.initializeSchema(client);
    } catch (error) {
      this.logger.error('Failed to connect to PostgreSQL', error);
      throw error;
    }

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
    client[Symbol.asyncDispose] = () => client.release()
    return client as RaiiPoolClient;
  }

  async getClient(): Promise<RaiiPoolClient> {
    const client = await this.pool.connect();
    return this.makeRaiiPoolClient(client);
  }

  async query<R = any>(text: string, params?: unknown[]): Promise<QueryResult<R>> {
    return Sentry.startSpan({
      name: "PG Pool Metrics",
      op: "pg-pool.query",
    }, async () => {
      const span = Sentry.getActiveSpan();
      if (span) {
        const { totalCount, waitingCount, idleCount, expiredCount } = this.pool
        span.setAttributes({
          "before.total_count": totalCount,
          "before.waiting_count": waitingCount,
          "before.expired_count": expiredCount,
          "before.idle_count": idleCount,
        })
      }
      const start = performance.now();
      const res = await this.pool.query<R>(text, params);
      const duration = performance.now() - start;
      if (span) {
        const { totalCount, waitingCount, idleCount, expiredCount } = this.pool
        span.setAttributes({
          "after.total_count": totalCount,
          "after.waiting_count": waitingCount,
          "after.expired_count": expiredCount,
          "after.idle_count": idleCount,
          duration,
        })
      }
      return res;
    })
  }

  async querySelect<R = any>(text: string, params?: unknown[]): Promise<QueryResult<R>> {
    const start = performance.now();
    const res = await this.poolRead.query<R>(text, params);
    const duration = performance.now() - start;
    this.logger.log('executed query', { text, duration, rows: res.rowCount })
    const { totalCount, waitingCount, idleCount } = this.pool
    this.logger.log('pool stats:', { totalCount, waitingCount, idleCount })
    return res;
  }
}
