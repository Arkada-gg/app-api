import { Client } from 'pg';

export const name = '1674235300005_seed_campaigns_and_quests';

export async function up(client: Client): Promise<void> {
  await client.query(`
    INSERT INTO campaigns (id, slug, name, description, image, rewards, started_at, finished_at, participants, type, created_at, updated_at)
    VALUES
      ('11111111-1111-1111-1111-111111111111', 'summer-sale', 'Summer Sale', 'Enjoy our exclusive summer discounts!', 'https://example.com/images/summer-sale.png',
        '[{"type": "tokens", "value": "100"}, {"type": "tokens", "value": "50"}]',
        '2025-01-01T00:00:00Z', '2025-06-30T23:59:59Z', 150, 'basic', NOW(), NOW()),
      
      ('22222222-2222-2222-2222-222222222222', 'winter-fest', 'Winter Fest', 'Join our winter festivities and earn rewards!', 'https://example.com/images/winter-fest.png',
        '[{"type": "tokens", "value": "200"}, {"type": "tokens", "value": "75"}]',
        '2025-01-01T00:00:00Z', '2025-12-31T23:59:59Z', 300, 'premium', NOW(), NOW()),
      
      ('33333333-3333-3333-3333-333333333333', 'spring-blossom', 'Spring Blossom', 'Celebrate the spring season with exciting quests!', 'https://example.com/images/spring-blossom.png',
        '[{"type": "tokens", "value": "150"}, {"type": "tokens", "value": "100"}]',
        '2025-01-01T00:00:00Z', '2025-03-31T23:59:59Z', 200, 'basic', NOW(), NOW())
    ON CONFLICT (slug) DO NOTHING;
  `);
}

export async function down(client: Client): Promise<void> {
  await client.query(`
    DELETE FROM campaigns
    WHERE id IN (
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333'
    );
  `);
}
