import { Client } from 'pg';

export const name = '1674235500022_add_project_fields_campaigns';

export async function up(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS project_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS project_description TEXT
  `);
}

export async function down(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE campaigns
    DROP COLUMN IF EXISTS project_name,
    DROP COLUMN IF EXISTS project_description
  `);
}
