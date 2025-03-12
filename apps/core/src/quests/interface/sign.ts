import { BigNumberish } from 'ethers';

export const SIGN_TYPES = {
  PyramidData: [
    { name: 'questId', type: 'string' },
    { name: 'nonce', type: 'uint256' },
    { name: 'price', type: 'uint256' },
    { name: 'toAddress', type: 'address' },
    { name: 'walletProvider', type: 'string' },
    { name: 'tokenURI', type: 'string' },
    { name: 'embedOrigin', type: 'string' },
    { name: 'transactions', type: 'TransactionData[]' },
    { name: 'recipients', type: 'FeeRecipient[]' },
    { name: 'reward', type: 'RewardData' },
  ],
  TransactionData: [
    { name: 'txHash', type: 'string' },
    { name: 'networkChainId', type: 'string' },
  ],
  FeeRecipient: [
    { name: 'recipient', type: 'address' },
    { name: 'BPS', type: 'uint16' },
  ],
  RewardData: [
    { name: 'tokenAddress', type: 'address' },
    { name: 'chainId', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'tokenType', type: 'uint8' },
    { name: 'rakeBps', type: 'uint256' },
    { name: 'factoryAddress', type: 'address' },
  ],
};

export interface IRewardData {
  tokenAddress: string;
  chainId: number;
  amount: BigNumberish;
  tokenId: number;
  tokenType: number;
  rakeBps: number;
  factoryAddress: string;
}

export interface ITransactionData {
  txHash: string;
  networkChainId: string;
}

export interface IFeeRecipient {
  recipient: string;
  BPS: number;
}

export interface IMintPyramidData {
  questId: string;
  nonce: number;
  price: BigNumberish;
  toAddress: string;
  walletProvider: string;
  tokenURI: string;
  embedOrigin: string;
  transactions: ITransactionData[];
  recipients: IFeeRecipient[];
  reward: IRewardData;
}
