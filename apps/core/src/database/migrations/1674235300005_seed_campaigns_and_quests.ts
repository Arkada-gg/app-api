import { Client } from 'pg';

export const name = '1674235300005_seed_campaigns_and_quests';

export async function up(client: Client): Promise<void> {
  await client.query(`
    INSERT INTO campaigns (id, slug, name, description, image, reward, started_at, finished_at, participants, type, created_at, updated_at)
    VALUES
      ('11111111-1111-1111-1111-111111111111', 'summer-sale', 'Summer Sale', 'Enjoy our exclusive summer discounts!', 'https://example.com/images/summer-sale.png',
        '[{"type": "type1", "value": "100 tokens"}, {"type": "type2", "value": "50 tokens"}]',
        '2025-01-01T00:00:00Z', '2025-06-30T23:59:59Z', 150, 'basic', NOW(), NOW()),
      
      ('22222222-2222-2222-2222-222222222222', 'winter-fest', 'Winter Fest', 'Join our winter festivities and earn rewards!', 'https://example.com/images/winter-fest.png',
        '[{"type": "type1", "value": "200 tokens"}, {"type": "type3", "value": "75 tokens"}]',
        '2025-01-01T00:00:00Z', '2025-12-31T23:59:59Z', 300, 'premium', NOW(), NOW()),
      
      ('33333333-3333-3333-3333-333333333333', 'spring-blossom', 'Spring Blossom', 'Celebrate the spring season with exciting quests!', 'https://example.com/images/spring-blossom.png',
        '[{"type": "type2", "value": "150 tokens"}, {"type": "type3", "value": "100 tokens"}]',
        '2025-01-01T00:00:00Z', '2025-03-31T23:59:59Z', 200, 'basic', NOW(), NOW())
    ON CONFLICT (slug) DO NOTHING;
  `);

  await client.query(`
    INSERT INTO quests (id, name, description, image, value, campaign_id, created_at, updated_at)
    VALUES
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Complete Onchain Task', 'Perform a specific onchain task to earn rewards.', 'https://example.com/images/onchain-task.png',
        '{"id": "quest1", "type": "onchain", "contract": "0xContractAddress", "method": "transfer", "event": "Transfer", "chain": "Ethereum"}',
        '11111111-1111-1111-1111-111111111111', NOW(), NOW()),
      
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Quiz Challenge', 'Answer a series of quiz questions to complete the quest.', 'https://example.com/images/quiz-challenge.png',
        '{"id": "quest2", "type": "quiz", "slides": [{"question": "What is NestJS?", "answers": ["A framework", "A language", "A library"]}, {"question": "What is TypeORM?", "answers": ["An ORM", "A database", "A server"]}]}',
        '11111111-1111-1111-1111-111111111111', NOW(), NOW()),
      
      ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Winter Onchain Quest', 'Engage in a winter-themed onchain activity.', 'https://example.com/images/winter-onchain.png',
        '{"id": "quest3", "type": "onchain", "contract": "0xWinterContract", "method": "mint", "event": "Minted", "chain": "Polygon"}',
        '22222222-2222-2222-2222-222222222222', NOW(), NOW()),
      
      ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Spring Quiz', 'Participate in a spring-themed quiz.', 'https://example.com/images/spring-quiz.png',
        '{"id": "quest4", "type": "quiz", "slides": [{"question": "What blooms in spring?", "answers": ["Flowers", "Snow", "Leaves"]}, {"question": "Which season comes after spring?", "answers": ["Summer", "Winter", "Autumn"]}]}',
        '33333333-3333-3333-3333-333333333333', NOW(), NOW()),
      
      ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Premium Onchain Quest', 'Exclusive onchain quest for premium campaigns.', 'https://example.com/images/premium-onchain.png',
        '{"id": "quest5", "type": "onchain", "contract": "0xPremiumContract", "method": "stake", "event": "Staked", "chain": "Binance Smart Chain"}',
        '22222222-2222-2222-2222-222222222222', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
}

export async function down(client: Client): Promise<void> {
  await client.query(`
    DELETE FROM quests
    WHERE id IN (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'dddddddd-dddd-dddd-dddd-dddddddddddd',
      'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
    );
  `);

  await client.query(`
    DELETE FROM campaigns
    WHERE id IN (
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333'
    );
  `);
}
