import { Client } from 'pg';

export const name = '1674235500000_add_link_quests_and_update_quest_type';

export async function up(client: Client): Promise<void> {
  await client.query(`ALTER TYPE quest_type ADD VALUE 'link'`);

  await client.query(
    `
    INSERT INTO quests (id, name, description, image, value, campaign_id, quest_type, sequence, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'Open Welcome Box',
      'Visit the ''Dashboard'' Page and claim your Welcome Box.',
      'https://example.com/images/welcome-box.png',
      $1,
      'd7b21298-c0e7-4af4-8001-8dbc7a8a89c7',
      'onchain',
      1,
      NOW(),
      NOW()
    )
  `,
    [
      JSON.stringify({
        endpoint:
          'https://api.supervol.io/inventory/welcome-box?address={$address}',
        expression:
          'function(data){ if (data == null || data.myCount == 0) { return 0; } return 1; }',
      }),
    ]
  );

  await client.query(
    `
    INSERT INTO quests (id, name, description, image, value, campaign_id, quest_type, sequence, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'Trade',
      'Make at least 1 Trade on SuperVol.',
      'https://example.com/images/trade.png',
      $1,
      'd7b21298-c0e7-4af4-8001-8dbc7a8a89c7',
      'onchain',
      2,
      NOW(),
      NOW()
    )
  `,
    [
      JSON.stringify({
        endpoint:
          'https://api.supervol.io/rounds/placed/{$address}?size=10&page=1',
        expression:
          'function(data){ if (data == null || data.totalCount == 0) { return 0; } return 1; }',
      }),
    ]
  );
}

export async function down(client: Client): Promise<void> {
  await client.query(
    `
    DELETE FROM quests
    WHERE quest_type = 'link'
      AND name IN ('Open Welcome Box', 'Trade')
  `
  );

  await client.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quest_type') THEN
        ALTER TYPE quest_type RENAME TO quest_type_old;
      END IF;
    END$$;
  `);

  await client.query(`
    CREATE TYPE quest_type AS ENUM ('onchain', 'quiz');
  `);

  await client.query(`
    ALTER TABLE quests ALTER COLUMN quest_type TYPE quest_type USING quest_type::text::quest_type;
  `);

  await client.query(`DROP TYPE quest_type_old;`);
}
