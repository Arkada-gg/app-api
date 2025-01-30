export interface QuestTask {
  id: string;
  type: string;
  chain: string;
  event: string;
  method?: string;
  methods?: string[];
  abi_to_find: string[];
  abi_equals: any;
  contract: string;
  tokens: string[];
  minAmountUSD?: number;
  abiFile: string;
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
