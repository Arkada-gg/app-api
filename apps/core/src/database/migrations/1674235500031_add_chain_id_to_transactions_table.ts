import { PoolClient } from 'pg';

export const name = '1674235500031_add_chain_id_to_transactions_table';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS chain_id INT DEFAULT 1868;
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE transactions
    DROP COLUMN IF EXISTS chain_id;
  `);
}
