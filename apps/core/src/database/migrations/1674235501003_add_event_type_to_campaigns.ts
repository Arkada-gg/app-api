import { Client } from 'pg';
export const name = '1674235501003_add_event_type_to_campaigns';
export async function up(client: Client): Promise<void> {
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 
        FROM pg_type t 
        JOIN pg_namespace ns ON ns.oid = t.typnamespace
        WHERE t.typname = 'event_type'
      ) THEN
        CREATE TYPE event_type AS ENUM ('default', 'mystery', 'special');
      END IF;
    END$$;
  `);

  await client.query(`
    ALTER TABLE campaigns
      ADD COLUMN IF NOT EXISTS event_type event_type
      NOT NULL DEFAULT 'default';
  `);
}
