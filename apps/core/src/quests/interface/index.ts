export interface QuestTask {
  id: string;
  type: string;
  chain: string;
  event: string;
  method?: string;
  methods?: string[];
  contract: string;
  tokens: string[];
  minSwapAmountUSD?: number;
  minLiquidityAmountUSD?: number;
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
