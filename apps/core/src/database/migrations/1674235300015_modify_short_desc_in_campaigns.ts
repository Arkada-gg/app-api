import { PoolClient } from 'pg';

export const name = '1674235300015_modify_short_desc_in_campaigns';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE campaigns
    ALTER COLUMN short_description TYPE TEXT;
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE campaigns
    ALTER COLUMN short_description TYPE VARCHAR(255);
  `);
}
