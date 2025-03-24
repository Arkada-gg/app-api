import { PoolClient } from 'pg';

export const name = '1674235300009_add_link_to_quests_table';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE quests
    ADD COLUMN IF NOT EXISTS link VARCHAR(255);
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE quests
    DROP COLUMN IF EXISTS link;
  `);
}
