import { Client } from 'pg';

export const name = '1674235700026_add_git_score_fields';

export async function up(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_git_score_update TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS git_score INTEGER DEFAULT 0
  `);
}

export async function down(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE users
    DROP COLUMN IF EXISTS last_git_score_update,
    DROP COLUMN IF EXISTS git_score
  `);
}