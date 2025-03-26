import { PoolClient } from 'pg';

export const name = '1679235800027_add_chain_id_to_txns';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS chain_id VARCHAR(255)
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE transactions
    DROP COLUMN IF EXISTS chain_id,
  `);
}
