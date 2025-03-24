import { PoolClient } from 'pg';
export const name = '1674235501002_add_discord_to_quest_type_enum';
export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumtypid = 'quest_type'::regtype
          AND enumlabel = 'discord'
      ) THEN
        ALTER TYPE quest_type ADD VALUE 'discord';
      END IF;
    END$$;
  `);
}
