import { PoolClient } from 'pg';

export const name = '1674235500030_add_pyramid_required_to_campaigns_table';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS pyramid_required BOOLEAN DEFAULT FALSE;
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE campaigns
    DROP COLUMN IF EXISTS pyramid_required;
  `);
}
