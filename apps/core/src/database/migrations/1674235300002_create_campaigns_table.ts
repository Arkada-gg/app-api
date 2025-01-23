import { Client } from 'pg';

export const name = '1674235300002_create_campaigns_table';

export async function up(client: Client): Promise<void> {
  await client.query(`
    CREATE TYPE campaign_type AS ENUM ('basic', 'premium');
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      image VARCHAR(255),
      reward JSONB NOT NULL,
      started_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
      finished_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
      participants INTEGER DEFAULT 0,
      type campaign_type NOT NULL,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    );
  `);
}

export async function down(client: Client): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS campaigns;
  `);

  await client.query(`
    DROP TYPE IF EXISTS campaign_type;
  `);
}
