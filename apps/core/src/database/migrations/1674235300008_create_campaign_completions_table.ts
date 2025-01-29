import { Client } from 'pg';

export const name = '1674235300008_create_campaign_completions_table';

export async function up(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS campaign_completions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
      user_address VARCHAR(255) NOT NULL,
      completed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
      UNIQUE (campaign_id, user_address)
    );
  `);

  await client.query(`
    ALTER TABLE campaign_completions
    ADD CONSTRAINT fk_campaign_completions_user_address
    FOREIGN KEY (user_address)
    REFERENCES users(address)
    ON DELETE CASCADE;
  `);
}

export async function down(client: Client): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS campaign_completions;
  `);
}
