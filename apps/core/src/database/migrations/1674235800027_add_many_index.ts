import { PoolClient } from 'pg';

export const name = '1674235600027_add_many_index';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS user_points_user_address_hash_idx
      ON user_points USING hash (user_address);

    CREATE INDEX CONCURRENTLY IF NOT EXISTS campaign_completions_user_address_hash_idx
      ON campaign_completions USING hash (user_address);

    CREATE INDEX CONCURRENTLY IF NOT EXISTS user_point_created_at_hash_idx
      ON user_points (created_at);

    CREATE INDEX CONCURRENTLY IF NOT EXISTS user_point_type_hash_idx
      ON user_points (point_type);

    CREATE INDEX CONCURRENTLY IF NOT EXISTS campaigns_completed_created_at_hash_idx
      ON campaign_completions (completed_at);

    CREATE INDEX CONCURRENTLY IF NOT EXISTS campaigns_completed_user_address_hash_idx
      ON campaign_completions USING hash (user_address);

    CREATE INDEX CONCURRENTLY IF NOT EXISTS campaigns_started_started_finished_at_idx
      ON campaigns (started_at, finished_at);

    CREATE INDEX CONCURRENTLY IF NOT EXISTS campaigns_type_hash_idx
      ON campaigns USING hash (type);
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DROP INDEX CONCURRENTLY IF EXISTS user_points_user_address_hash_idx;

    DROP INDEX CONCURRENTLY IF EXISTS campaign_completions_user_address_hash_idx;

    DROP INDEX CONCURRENTLY IF EXISTS user_address_hash_idx;

    DROP INDEX CONCURRENTLY IF EXISTS user_point_cteated_at_hash_idx;

    DROP INDEX CONCURRENTLY IF EXISTS user_point_type_hash_idx;

    DROP INDEX CONCURRENTLY IF EXISTS campaigns_completed_created_at_hash_idx;

    DROP INDEX CONCURRENTLY IF EXISTS campaigns_completed_user_address_hash_idx;

    DROP INDEX CONCURRENTLY IF EXISTS campaigns_started_started_finished_at_idx;

    DROP INDEX CONCURRENTLY IF EXISTS campaigns_type_hash_idx;
  `);
}
