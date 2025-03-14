import { Client } from 'pg';

export const name = '1674235500029_add_pyramid_fields_to_user_table';

export async function up(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS pyramid_basic INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pyramid_gold INT DEFAULT 0;
  `);
}

export async function down(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE users
    DROP COLUMN IF EXISTS pyramid_basic,
    DROP COLUMN IF EXISTS pyramid_gold;
  `);
}
