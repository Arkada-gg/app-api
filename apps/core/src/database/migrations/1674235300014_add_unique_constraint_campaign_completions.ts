import { Client } from 'pg';

export const name = '1674235300014_add_unique_constraint_campaign_completions';

export async function up(client: Client): Promise<void> {
  try {
    await client.query(`
      ALTER TABLE campaign_completions
      ADD CONSTRAINT unique_campaign_user UNIQUE (campaign_id, user_address);
    `);
    console.log(
      'Уникальное ограничение unique_campaign_user успешно добавлено.'
    );
  } catch (error) {
    if ((error as any).code === '23505') {
      console.warn(
        'Уникальное ограничение unique_campaign_user уже существует.'
      );
    } else {
      console.error('Ошибка при добавлении уникального ограничения:', error);
      throw error;
    }
  }
}

export async function down(client: Client): Promise<void> {
  try {
    await client.query(`
      ALTER TABLE campaign_completions
      DROP CONSTRAINT IF EXISTS unique_campaign_user;
    `);
    console.log('Уникальное ограничение unique_campaign_user успешно удалено.');
  } catch (error) {
    console.error('Ошибка при удалении уникального ограничения:', error);
    throw error;
  }
}
