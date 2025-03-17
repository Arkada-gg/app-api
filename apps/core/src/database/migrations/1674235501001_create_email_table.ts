import { Client } from 'pg';

export const name = '1674235501001_create_email_table';

export async function up(client: Client): Promise<void> {
  await client.query(`
CREATE TABLE IF NOT EXISTS user_email (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  address VARCHAR(255) UNIQUE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
  `);
}

export async function down(client: Client): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS user_email;
  `);
}
