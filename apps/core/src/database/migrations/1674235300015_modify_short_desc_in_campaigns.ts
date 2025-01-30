import { Client } from 'pg';

export const name = '1674235300015_modify_short_desc_in_campaigns';

export async function up(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE campaigns
    ALTER COLUMN short_description TYPE TEXT;
  `);
}

export async function down(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE campaigns
    ALTER COLUMN short_description TYPE VARCHAR(255);
  `);
}
