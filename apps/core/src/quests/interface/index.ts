export interface QuestTask {
  methodSignatures?: any;
  id: string;
  type: string;
  chain: string;
  event: string;
  method?: string;
  methods?: string[];
  endpoint?: string;
  expression?: string;
  abi_to_find: string[];
  method_equals: string;
  abi_equals: any;
  contract: string;
  contract1?: string;
  contracts?: string[];
  tokens: string[];
  tokenAddress?: string;
  minAmountUSD?: number;
  minAmountToken?: number;
  abiFile: string;
  params?: any;
  actions?: any;
  method_signatures?: any;
  guildId?: string;
  methodToFind: string[];
  minTxns?: number;
  methodChecks?: any;
  methodToExecute?: string;
  methodToEqual?: any;
  url?: string;
}

export interface QuestType {
  id: string;
  name: string;
  description: string;
  image: string;
  value: QuestTask;
  campaign_id: string;
  created_at: Date;
  updated_at: Date;
  sequence: number;
  type: string;
  link: string;
  quest_type: string;
}

export enum EPointsType {
  Campaign = 'base_campaign',
  Quest = 'base_quest',
  Referral = 'referral',
  Daily = 'daily',
}
