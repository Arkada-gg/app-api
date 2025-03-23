import { PoolClient } from 'pg';
export const name = '20250311_add_chain_id_to_campaigns';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE campaigns
      ADD COLUMN IF NOT EXISTS chain_id VARCHAR(255)
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE campaigns
      DROP COLUMN IF EXISTS chain_id
  `);
}
