import * as m1 from './1674235300001_create_users_table';
import * as m2 from './1674235300002_create_campaigns_table';
import * as m3 from './1674235300003_create_quests_table';
import * as m4 from './1674235300004_create_quest_completions_table';
import * as m5 from './1674235300007_add_indexes';
import * as m6 from './1674235300008_create_campaign_completions_table';
import * as m7 from './1674235300009_add_link_to_quests_table';
import * as m8 from './1674235300010_add_short_description_and_difficulty_to_campaigns_table';
import * as m9 from './1674235300011_modify_promo_column_in_campaigns';
import * as m10 from './1674235300014_add_unique_constraint_campaign_completions';
import * as m11 from './1674235300015_modify_short_desc_in_campaigns';
import * as m12 from './1674235300016_recreate_quest_type_enum';
// import * as m13 from './1674235500017_add_link_quests_and_update_quest_type';
import * as m14 from './1674235500018_add_referral_columns_and_points_history';
import * as m15 from './1674235500019_assign_ref_codes_to_existing_users';
import * as m16 from './1674235500020_add_users_reffered_amount';
import * as m17 from './1674235500021_user_telegram_to_jsonb';
import * as m18 from './1674235500022_add_project_fields_campaigns';
import * as m19 from './1674235500023_add_daily_point_type';
import * as m20 from './1674235500024_add_campaign_status_column';
import * as m21 from './1674235500025_add_twitter_points_column';
import * as m22 from './1674235500026_add_transactions_table';
import * as m23 from './1674235500027_add_ignore_campaign_start_to_campaigns';
import * as m26 from './1674235500028_add_project_logo_and_category_to_campaigns';
import * as m33 from './1674235500029_add_pyramid_fields_to_user_table';
import * as m34 from './1674235500030_add_pyramid_required_to_campaigns_table';
import * as m24 from './1674235501000_create_discord_guilds_table';
import * as m25 from './1674235501001_create_email_table';
import * as m27 from './1674235501002_add_discord_to_quest_type_enum';
import * as m28 from './1674235501003_add_event_type_to_campaigns';
import * as m29 from './1674235501004_add_hash_to_quest_completions';
import * as m32 from './1674235501005_add_chain_id_to_campaigns';
import * as m30 from './1674235600025_add_wallet_points_columns';
import * as m31 from './1674235700025_add_last_wallet_score_update_column';
import * as m35 from './1674235700026_add_last_git_score_update_column'
// import * as s1 from './1674235300005_seed_campaigns_and_quests';
// import * as s2 from './1674235300006_add_swap_and_add_liquidity_quests';
import * as s3 from './1674235300013_seed_sonnex_campaign_and_quiz_quest';

export const allMigrations = [
  m1,
  m2,
  m3,
  m4,
  m5,
  m6,
  m7,
  m8,
  m9,
  m10,
  m11,
  m12,
  // m13,
  m14,
  m15,
  m16,
  m17,
  m18,
  m19,
  m20,
  m21,
  m22,
  m23,
  m24,
  m25,
  m26,
  m27,
  m28,
  m29,
  m30,
  m31,
  m32,
  m33,
  m34,
  m35,
  // s1,
  // s2,
  s3,
];
