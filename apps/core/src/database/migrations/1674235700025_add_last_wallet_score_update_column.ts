import { PoolClient } from 'pg';

export const name = '1674235700025_add_last_wallet_score_update_column';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_wallet_score_update TIMESTAMP WITH TIME ZONE DEFAULT NULL
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE users
    DROP COLUMN IF EXISTS last_wallet_score_update
  `);
}
