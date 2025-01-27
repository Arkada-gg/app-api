import { Client } from 'pg';

export const name = '1674235300007_add_indexes';

export async function up(client: Client): Promise<void> {
  await client.query('BEGIN');

  try {
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_quest_completions_user_address
      ON quest_completions(user_address);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_quest_completions_quest_id
      ON quest_completions(quest_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_quests_campaign_id
      ON quests(campaign_id);
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

export async function down(client: Client): Promise<void> {
  await client.query('BEGIN');

  try {
    await client.query(`
      DROP INDEX IF EXISTS idx_quest_completions_user_address;
      DROP INDEX IF EXISTS idx_quest_completions_quest_id;
      DROP INDEX IF EXISTS idx_quests_campaign_id;
      DROP INDEX IF EXISTS idx_users_points;
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
