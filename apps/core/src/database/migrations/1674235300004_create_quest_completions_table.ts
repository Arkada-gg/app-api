import { Client } from 'pg';

export const name = '1674235300004_create_quest_completions_table';

export async function up(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS quest_completions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      quest_id UUID REFERENCES quests(id) ON DELETE CASCADE,
      user_address VARCHAR(255) NOT NULL,
      completed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
      UNIQUE (quest_id, user_address)
    );
  `);
}

export async function down(client: Client): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS quest_completions;
  `);
}
