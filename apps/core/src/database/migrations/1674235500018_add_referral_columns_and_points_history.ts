import { PoolClient } from 'pg';

export const name = '1674235300018_add_referral_columns_and_points_history';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS referral_code VARCHAR(255)
  `);

  await client.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS ref_owner VARCHAR(255)
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_idx
    ON users(referral_code)
  `);

  await client.query(`
    DO $$
    BEGIN
      CREATE TYPE point_type_enum AS ENUM ('base_campaign', 'base_quest', 'referral');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END
    $$;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS user_points (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_address VARCHAR(255) NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      point_type point_type_enum NOT NULL,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
    );
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS user_points;
  `);

  await client.query(`
    DO $$
    BEGIN
      DROP TYPE IF EXISTS point_type_enum;
    EXCEPTION
      WHEN undefined_object THEN null;
    END
    $$;
  `);

  await client.query(`
    DROP INDEX IF EXISTS users_referral_code_idx;
  `);

  await client.query(`
    ALTER TABLE users
    DROP COLUMN IF EXISTS referral_code,
    DROP COLUMN IF EXISTS ref_owner;
  `);
}
