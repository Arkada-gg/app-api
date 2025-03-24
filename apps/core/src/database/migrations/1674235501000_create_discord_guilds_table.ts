import { PoolClient } from 'pg';

export const name = '1674235501000_create_discord_guilds_table';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS discord_guilds (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL UNIQUE,
      project_id TEXT, 
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS discord_guilds;
  `);
}
