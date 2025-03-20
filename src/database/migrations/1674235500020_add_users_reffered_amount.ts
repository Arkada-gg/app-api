import { Client } from 'pg';

export const name = '1674235500020_add_users_reffered_amount';

export async function up(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE users
    ADD COLUMN ref_count INTEGER DEFAULT 0
  `);
}

export async function down(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE users
    DROP COLUMN IF EXISTS referral_code,
  `);
}
