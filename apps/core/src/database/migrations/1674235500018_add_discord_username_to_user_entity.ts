import { PoolClient } from 'pg';

export const name = '1674235500018_add_discord_username_to_user_entity';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS discord VARCHAR(255);
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE users
    DROP COLUMN IF EXISTS discord;
  `);
}
