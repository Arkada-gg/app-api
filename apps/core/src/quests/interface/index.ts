export interface QuestTask {
  id: string;
  type: string;
  chain: string;
  event: string;
  method?: string;
  methods?: string[];
  endpoint?: string;
  expression?: string;
  abi_to_find: string[];
  abi_equals: any;
  contract: string;
  contract1?: string;
  contracts?: string[];
  tokens: string[];
  tokenAddress?: string;
  minAmountUSD?: number;
  abiFile: string;
  params?: any;
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
}
