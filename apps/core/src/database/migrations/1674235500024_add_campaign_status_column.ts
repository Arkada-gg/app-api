import { PoolClient } from 'pg';

export const name = '1674235500023_add_campaign_status_column';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    DO $$
    BEGIN
      CREATE TYPE campaign_status_enum AS ENUM ('IN_PROGRESS', 'FINISHED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END
    $$;
  `);

  await client.query(`
    ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS status campaign_status_enum NOT NULL DEFAULT 'IN_PROGRESS';
  `);

  await client.query(`
    UPDATE campaigns
    SET status = 'FINISHED'
    WHERE finished_at < NOW()
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE campaigns
    DROP COLUMN IF EXISTS status;
  `);

  await client.query(`
    DROP TYPE IF EXISTS campaign_status_enum;
  `);
}
