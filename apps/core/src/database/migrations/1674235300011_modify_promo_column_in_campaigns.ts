import { PoolClient } from 'pg';

export const name = '1674235300012_modify_promo_column_in_campaigns';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE campaigns
    ALTER COLUMN promo TYPE TEXT;
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE campaigns
    ALTER COLUMN promo TYPE VARCHAR(255);
  `);
}
