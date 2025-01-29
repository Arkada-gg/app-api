import { Client } from 'pg';

export const name = '1674235300012_modify_promo_column_in_campaigns';

export async function up(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE campaigns
    ALTER COLUMN promo TYPE TEXT;
  `);
}

export async function down(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE campaigns
    ALTER COLUMN promo TYPE VARCHAR(255);
  `);
}
