import { Client } from 'pg';

export const name = '1674235700025_add_last_wallet_score_update_column';

export async function up(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_wallet_score_update TIMESTAMP WITH TIME ZONE DEFAULT NULL
  `);
}

export async function down(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE users
    DROP COLUMN IF EXISTS last_wallet_score_update
  `);
}