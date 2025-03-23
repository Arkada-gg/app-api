import { PoolClient } from 'pg';

export const name = '1674235300003_create_quests_table';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
CREATE TYPE public.quest_type AS ENUM (
     'onchain',
     'quiz',
     'twitter',
     'link',
     'discord'
 );

    CREATE TABLE IF NOT EXISTS quests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      image VARCHAR(255),
      value JSONB NOT NULL,
      campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
      quest_type quest_type NOT NULL,
      sequence INTEGER,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    );
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS quests;
  `);

  await client.query(`
    DROP TYPE IF EXISTS quest_type;
  `);
}
