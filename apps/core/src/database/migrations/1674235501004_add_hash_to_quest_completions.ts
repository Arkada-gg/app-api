import { Client } from 'pg';
export const name = '1674235501004_add_hash_to_quest_completions';

export async function up(client: Client): Promise<void> {
  await client.query(`
    ALTER TABLE quest_completions
      ADD COLUMN IF NOT EXISTS transaction_hash VARCHAR(255)
  `);
}
