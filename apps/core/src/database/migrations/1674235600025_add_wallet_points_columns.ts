import { Client } from 'pg';

export const name = '1674235600025_add_wallet_points_columns';

export async function up(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS wallet_points INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS wallet_additional_points INTEGER DEFAULT 0
  `);
}

export async function down(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE users
    DROP COLUMN IF EXISTS wallet_points,
    DROP COLUMN IF EXISTS wallet_additional_points
  `);
}