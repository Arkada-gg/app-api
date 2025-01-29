import { Client } from 'pg';

export const name = '1674235300001_create_users_table';

export async function up(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      address VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255),
      avatar VARCHAR(255),
      twitter VARCHAR(255),
      discord VARCHAR(255),
      telegram VARCHAR(255),
      github VARCHAR(255),
      email VARCHAR(255) UNIQUE,
      points INTEGER DEFAULT 0,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    );
  `);
}

export async function down(client: Client): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS users;
  `);
}
