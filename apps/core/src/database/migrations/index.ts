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

// import * as s1 from './1674235300005_seed_campaigns_and_quests';
// import * as s2 from './1674235300006_add_swap_and_add_liquidity_quests';
import * as s3 from './1674235300013_seed_sonnex_campaign_and_quiz_quest';

export const allMigrations = [m1, m2, m3, m4, m5, m6, m7, m8, m9, s3, m10];
