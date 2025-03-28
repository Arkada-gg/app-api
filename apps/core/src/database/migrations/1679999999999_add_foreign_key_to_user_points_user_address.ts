import { Client } from 'pg';
import { RaiiPoolClient } from '../database.service';

export const name = '1679999999999_add_foreign_key_to_user_points_user_address';

export async function up(client: RaiiPoolClient): Promise<void> {
  await client.query(`
    INSERT INTO users (address)
    SELECT DISTINCT user_address
    FROM user_points
    WHERE user_address IS NOT NULL
      AND user_address NOT IN (SELECT address FROM users);
  `);

  await client.query(`
    ALTER TABLE user_points
    ADD CONSTRAINT user_points_user_address_fk
    FOREIGN KEY (user_address)
    REFERENCES users(address)
    ON UPDATE CASCADE
    ON DELETE SET NULL;
  `);
}

export async function down(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE user_points
    DROP CONSTRAINT IF EXISTS user_points_user_address_fk;
  `);
}
