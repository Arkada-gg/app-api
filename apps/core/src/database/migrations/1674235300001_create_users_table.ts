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
      github VARCHAR(255)
    );
  `);
}
