import { Client } from 'pg';

export const name = '1674235500030_add_pyramid_required_to_campaigns_table';

export async function up(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS pyramid_required BOOLEAN DEFAULT FALSE;
  `);
}

export async function down(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE campaigns
    DROP COLUMN IF EXISTS pyramid_required;
  `);
}
