import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { ConfigService } from '../_config/config.service';

const arrOfIdsCtx = new Map()
class PgClientWrapper {
  private client: any
  private id: any
  private ctx: any
  constructor(client, id, ctx) {
    this.client = client;
    this.id = id
    this.ctx = ctx
  }

  async query(text, params?) {
    // console.log(`Executing query: ${text} with parameters:`, params);
    const res = await this.client.query(text, params);
    // console.log(`Query result:`, res.rows);
    return res;
  }

  release() {
    arrOfIdsCtx.delete(this.id)
    return this.client.release();
  }

  async [Symbol.asyncIterator]() {
    return this.client[Symbol.asyncIterator]();
  }

  get methods() {
    const clientMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(this.client));
    const wrapper = {};

    clientMethods.forEach((method) => {
      if (method !== 'query' && method !== 'release') {
        wrapper[method] = (...args) => this.client[method](...args);
      }
    });

    return wrapper;
  }
}


@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  constructor(private readonly configService: ConfigService) {
    this.pool = new Pool({
      connectionString: this.configService.get('DATABASE_URL') ||
        'postgres://user:password@localhost:5432/arkada_db',
      idleTimeoutMillis: 5000,
      max: 20
    });
  }

  async onModuleInit() {
    const client = await this.pool.connect();
    try {
      this.logger.log('Connected to PostgreSQL');
      try {
        await this.initializeSchema(client);
      } catch (error) {
        console.log('--error---->', error);
      }
      client.release()
    } catch (error) {
      console.log('------>', error);
    }
  }

  private async initializeSchema(client: PoolClient) {
    await client.query(`
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



  async getClient(): Promise<PoolClient> {
    const x = crypto.randomUUID()
    const ctx = new Error().stack
    arrOfIdsCtx.set(x, ctx)
    // console.log('------>', arrOfIdsCtx);
    const wrappedPg = new PgClientWrapper(await this.pool.connect(), x, ctx);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    return wrappedPg satisfies PoolClient;
  }
}
