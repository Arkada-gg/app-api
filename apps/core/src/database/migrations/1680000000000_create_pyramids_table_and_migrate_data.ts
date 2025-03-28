import { Client } from 'pg';
import { RaiiPoolClient } from '../database.service';

export const name = '1680000000000_create_user_pyramids_table_and_migrate_data';

export async function up(client: RaiiPoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS user_pyramids (
      id SERIAL PRIMARY KEY,
      user_address VARCHAR(255) NOT NULL,
      chain_id INTEGER NOT NULL,
      basic_amount INTEGER DEFAULT 0,
      gold_amount INTEGER DEFAULT 0,
      CONSTRAINT user_pyramids_user_address_fk FOREIGN KEY (user_address)
        REFERENCES users(address) ON DELETE CASCADE
    );
  `);

  await client.query(`
    INSERT INTO user_pyramids (user_address, chain_id, basic_amount, gold_amount)
    SELECT 
      address,
      (key::int) AS chain_id,
      COALESCE((value->>'basic')::int, 0) AS basic_amount,
      COALESCE((value->>'gold')::int, 0) AS gold_amount
    FROM users,
         jsonb_each(pyramids_info) AS data(key, value)
    WHERE pyramids_info IS NOT NULL;
  `);
}

export async function down(client: Client): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS user_pyramids;
  `);
}
