import { Client } from 'pg';

export const name = '1674235500026_add_transactions_table';

export async function up(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      hash VARCHAR(66) PRIMARY KEY,
      event_name TEXT NOT NULL,
      block_number BIGINT NOT NULL,
      args JSONB NOT NULL,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    );
  `);
}

export async function down(client: Client): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS transactions;
  `);
}
