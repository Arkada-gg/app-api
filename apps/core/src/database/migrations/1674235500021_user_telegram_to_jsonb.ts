import { Client } from 'pg';

export const name = '1674235500021_user_telegram_to_jsonb';

export async function up(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE users 
    ADD COLUMN telegram_new JSONB DEFAULT null::JSONB;
  `);

  await client.query(`
    UPDATE users 
    SET telegram_new = jsonb_build_object('username', telegram)
    WHERE telegram IS NOT NULL;
  `);

  await client.query(`
    ALTER TABLE users DROP COLUMN telegram;
  `);

  await client.query(`
    ALTER TABLE users RENAME COLUMN telegram_new TO telegram;
  `);
}

export async function down(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE users 
    ADD COLUMN telegram TEXT;
  `);

  await client.query(`
    UPDATE users 
    SET telegram = telegram_new->>'username'
    WHERE telegram_new IS NOT NULL;
  `);

  await client.query(`
    ALTER TABLE users DROP COLUMN telegram_new;
  `);
}
