import { PoolClient } from 'pg';

export const name = '1674235300026_add_daily_point_type_enum_recreate';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TYPE point_type_enum_new AS ENUM (
      'base_campaign',
      'base_quest',
      'referral',
      'daily'
    );
  `);

  await client.query(`
    ALTER TABLE user_points
    ALTER COLUMN point_type DROP DEFAULT,
    ALTER COLUMN point_type TYPE point_type_enum_new
    USING point_type::text::point_type_enum_new
  `);

  await client.query(`
    DROP TYPE point_type_enum;
  `);

  await client.query(`
    ALTER TYPE point_type_enum_new
    RENAME TO point_type_enum;
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TYPE point_type_enum_old AS ENUM (
      'base_campaign',
      'base_quest',
      'referral'
    );
  `);

  await client.query(`
    ALTER TABLE user_points
    ALTER COLUMN point_type DROP DEFAULT,
    ALTER COLUMN point_type TYPE point_type_enum_old
    USING point_type::text::point_type_enum_old
  `);

  await client.query(`
    DROP TYPE point_type_enum;
  `);

  await client.query(`
    ALTER TYPE point_type_enum_old
    RENAME TO point_type_enum;
  `);
}
