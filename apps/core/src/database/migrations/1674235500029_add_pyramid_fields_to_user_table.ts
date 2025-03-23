import { PoolClient } from 'pg';

export const name = '1674235500029_add_pyramid_fields_to_user_table';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS pyramids_info JSONB DEFAULT null::JSONB;
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE users
    DROP COLUMN IF EXISTS pyramids_info;
  `);
}
