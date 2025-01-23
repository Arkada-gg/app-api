import * as m1 from './1674235300001_create_users_table';
import * as m2 from './1674235300002_create_campaigns_table';
import * as m3 from './1674235300003_create_quests_table';
import * as m4 from './1674235300004_create_quest_completions_table';
import * as s1 from './1674235300005_seed_campaigns_and_quests';

export const allMigrations = [m1, m2, m3, m4, s1];
