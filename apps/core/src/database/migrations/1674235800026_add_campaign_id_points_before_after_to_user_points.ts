import { PoolClient } from 'pg';

export const name = '1674235600026_add_campaign_id_points_before_after_to_user_points';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE user_points
    ADD COLUMN IF NOT EXISTS campaign_id UUID 
      REFERENCES campaigns(id) 
      ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS points_before INTEGER,
    ADD COLUMN IF NOT EXISTS points_after INTEGER
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE user_points
    DROP COLUMN IF EXISTS campaign_id,
    DROP COLUMN IF EXISTS points_before,
    DROP COLUMN IF EXISTS points_after
  `);
}
