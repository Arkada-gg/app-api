import { Client } from 'pg';

export const name = '1674235500025_add_twitter_points_column';

export async function up(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS twitter_points INTEGER DEFAULT 0
  `);
}

export async function down(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE users
    DROP COLUMN IF EXISTS twitter_points
  `);
}
