import { Client } from 'pg';

export const name =
  '1674235300012_add_short_description_and_difficulty_to_campaigns_table';

export async function up(client: Client): Promise<void> {
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'difficulty') THEN
        CREATE TYPE difficulty AS ENUM ('easy', 'medium', 'hard');
      END IF;
    END
    $$;
  `);

  await client.query(`
    ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS short_description VARCHAR(255);
  `);

  await client.query(`
    ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS difficulty difficulty NOT NULL DEFAULT 'medium';
  `);
}

export async function down(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE campaigns
    DROP COLUMN IF EXISTS difficulty;
  `);

  await client.query(`
    ALTER TABLE campaigns
    DROP COLUMN IF EXISTS short_description;
  `);

  await client.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'difficulty') THEN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_depend
          WHERE refobjid = 'difficulty'::regtype
        ) THEN
          DROP TYPE difficulty;
        END IF;
      END IF;
    END
    $$;
  `);
}
