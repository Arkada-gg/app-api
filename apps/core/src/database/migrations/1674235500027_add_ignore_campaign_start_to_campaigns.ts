import { PoolClient } from 'pg';

export const name = '1674235500027_add_ignore_campaign_start_to_campaigns';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS ignore_campaign_start BOOLEAN DEFAULT false;
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE campaigns
    DROP COLUMN IF EXISTS ignore_campaign_start;
  `);
}
