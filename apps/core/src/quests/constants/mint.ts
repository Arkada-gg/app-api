import { parseEther } from 'ethers';
import { ARKADA_NFTS } from '../../shared/constants/addresses';

export const BASIC_QUEST_MINT_PRICE =
  process.env.ENV === 'stage'
    ? parseEther('0.000000075')
    : parseEther('0.000075');
export const PREMIUM_QUEST_MINT_PRICE =
  process.env.ENV === 'stage'
    ? parseEther('0.00000015')
    : parseEther('0.00015');

export const MAX_BPS = 10000; // 100%
export const REF_OWNER_BPS = 1000; // 10%
export const USER_REWARD_BPS = 2000; // 20%

export const ARKADA_NFTS_MULTIPLIER_BPS: Record<ARKADA_NFTS, number> = {
  [ARKADA_NFTS.BUSHI]: 1000, // 10%
  [ARKADA_NFTS.SHOGUN_SECOND]: 2000, // 20%
};
