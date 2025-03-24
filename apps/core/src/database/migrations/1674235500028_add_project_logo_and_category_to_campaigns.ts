import { PoolClient } from 'pg';

export const name = '1674235500028_add_project_logo_and_category_to_campaigns';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS project_logo VARCHAR(255),
    ADD COLUMN IF NOT EXISTS category TEXT[] DEFAULT NULL;
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE campaigns
    DROP COLUMN IF EXISTS project_logo,
    DROP COLUMN IF EXISTS category;
  `);
}
