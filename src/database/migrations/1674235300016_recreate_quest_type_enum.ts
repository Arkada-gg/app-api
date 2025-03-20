import { Client } from 'pg';

export const name = '1674235300004_recreate_quest_type_enum';

export async function up(client: Client): Promise<void> {
  await client.query('BEGIN');

  await client.query(`
    ALTER TABLE quests
    ALTER COLUMN quest_type DROP DEFAULT,
    ALTER COLUMN quest_type TYPE TEXT
    USING quest_type::TEXT;
  `);

  await client.query(`
    DROP TYPE IF EXISTS quest_type;
  `);

  await client.query(`
    CREATE TYPE quest_type AS ENUM ('onchain', 'quiz', 'twitter');
  `);

  await client.query(`
    ALTER TABLE quests
    ALTER COLUMN quest_type TYPE quest_type
    USING quest_type::quest_type,
    ALTER COLUMN quest_type SET DEFAULT 'onchain';
  `);

  await client.query('COMMIT');
}

export async function down(client: Client): Promise<void> {
  await client.query('BEGIN');

  await client.query(`
    ALTER TABLE quests
    ALTER COLUMN quest_type DROP DEFAULT,
    ALTER COLUMN quest_type TYPE TEXT
    USING quest_type::TEXT;
  `);

  await client.query(`
    DROP TYPE IF EXISTS quest_type;
  `);

  await client.query(`
    CREATE TYPE quest_type AS ENUM ('onchain');
  `);

  await client.query(`
    ALTER TABLE quests
    ALTER COLUMN quest_type TYPE quest_type
    USING quest_type::quest_type,
    ALTER COLUMN quest_type SET DEFAULT 'onchain';
  `);

  await client.query('COMMIT');
}
