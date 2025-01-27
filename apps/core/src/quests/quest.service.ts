import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { QuestRepository } from './quest.repository';
import { ethers } from 'ethers';
import { provider } from '../shared/provider';
import fetch from 'node-fetch';
import { QuestTask, QuestType } from './interface';
import { UniswapV3ABI } from '../shared/abi/uniswapV3';
import { ArkadaAbi } from '../shared/abi/arkada';
import { SwapRouterABI } from '../shared/abi/swapRouter';
import { UserService } from '../user/user.service';
import { CampaignService } from '../campaigns/campaign.service';

@Injectable()
export class QuestService {
  private readonly contractAbiMap: { [contractAddress: string]: any } = {
    '0xdef357d505690f1b0032a74c3b581163c23d1535': SwapRouterABI,
    '0x6f5f9d55f727928b644b04d987b1c0cf50af8c0b': UniswapV3ABI,
    '0xcC943afF0F3F8746CCbC3f54BB8869176dBb17F3': ArkadaAbi,
  };

  private readonly tokenToCoingeckoId: { [token: string]: string } = {
    ethereum: 'ethereum',
    astroport: 'astar',
  };

  private priceCache: {
    [tokenId: string]: { price: number; timestamp: number };
  } = {};

  constructor(
    private readonly questRepository: QuestRepository,
    private readonly userService: UserService,
    private readonly campaignService: CampaignService
  ) {}

  async getAllCompletedQuestsByUser(address: string) {
    return await this.questRepository.getAllCompletedQuestsByUser(address);
  }

  async getCompletedQuestsByUserInCampaign(
    address: string,
    campaignId: string
  ) {
    return await this.questRepository.getCompletedQuestsByUserInCampaign(
      address,
      campaignId
    );
  }

  async completeQuestAndAwardPoints(
    questId: string,
    userAddress: string
  ): Promise<void> {
    try {
      const quest = await this.questRepository.getQuest(questId);
      const campaignId = quest.campaign_id;

      const alreadyCompleted =
        await this.campaignService.hasUserCompletedCampaign(
          campaignId,
          userAddress
        );

      if (alreadyCompleted) return;

      const allCampaignQuests = await this.questRepository.getQuestsByCampaign(
        campaignId
      );

      console.log('------>', allCampaignQuests);

      const completedQuests =
        await this.questRepository.getCompletedQuestsByUserInCampaign(
          userAddress,
          campaignId
        );

      console.log('------>', completedQuests, campaignId);

      if (completedQuests.length === allCampaignQuests.length) {
        const campaign = await this.campaignService.getCampaignByIdOrSlug(
          campaignId
        );
        const rewards = campaign.rewards; // [{ "type": "type1", "value": "100 tokens" }, ...]
        console.log('campaign------>', campaign);
        let totalPoints = 0;
        rewards.forEach((reward: any) => {
          if (reward.type === 'tokens') {
            totalPoints += parseInt(reward.value, 10);
          }
        });

        await this.userService.updatePoints(userAddress, totalPoints);
        await this.campaignService.completeCampaignForUser(
          campaignId,
          userAddress
        );
      }
    } catch (error) {
      throw new InternalServerErrorException(
        `Ошибка при завершении квеста и начислении баллов: ${error.message}`
      );
    }
  }

  async checkQuest(id: string, address: string): Promise<boolean> {
    try {
      const isCompleted = await this.questRepository.checkQuestCompletion(
        id,
        address
      );
      if (isCompleted) {
        return true;
      }

      const questStored: QuestType = await this.questRepository.getQuest(id);
      const questTask: QuestTask = questStored.value;

      const allQuests: QuestType[] =
        await this.questRepository.getQuestsByCampaign(questStored.campaign_id);

      const currentQuestIndex = allQuests.findIndex(
        (quest) => quest.id === questStored.id
      );

      if (currentQuestIndex === -1) {
        throw new NotFoundException(
          `Quest with id ${id} not found in campaign`
        );
      }

      for (let i = 0; i < currentQuestIndex; i++) {
        const priorQuest = allQuests[i];
        const isPriorQuestCompleted =
          await this.questRepository.checkQuestCompletion(
            priorQuest.id,
            address
          );
        if (!isPriorQuestCompleted) {
          throw new BadRequestException(
            `For completing this quest you have to pass : ${priorQuest.name}`
          );
        }
      }

      const abi = this.contractAbiMap[questTask.contract.toLowerCase()];
      if (!abi) {
        throw new InternalServerErrorException(
          `ABI for contract ${questTask.contract.toLowerCase()} not found`
        );
      }

      const contractInterface = new ethers.Interface(abi);

      let url: string | undefined;
      if (questTask.chain === 'Soneium') {
        url = `https://soneium.blockscout.com/api?module=account&action=txlist&address=${address}&startblock=0&endblock=latest&page=1&offset=100&sort=asc`;
      } else {
        throw new BadRequestException(`Unsupported chain: ${questTask.chain}`);
      }

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new InternalServerErrorException(
          `Error while requesting BS API: ${res.statusText}`
        );
      }

      const data = await res.json();

      if (data.status !== '1' || !Array.isArray(data.result)) {
        throw new BadRequestException('Incorrect response from BS API');
      }

      const transactions = data.result;
      const userTransactions = transactions.filter(
        (tx: any) =>
          tx.to &&
          typeof tx.to === 'string' &&
          tx.to.toLowerCase() === questTask.contract.toLowerCase() &&
          tx.from &&
          typeof tx.from === 'string' &&
          tx.from.toLowerCase() === address.toLowerCase()
      );

      Logger.debug(
        `Amount of txns for user ${address}: ${userTransactions.length}`
      );

      for (const tx of userTransactions) {
        const txHash = tx.hash;
        const isQuestCompleted = await this.decodeTransaction(
          txHash,
          address,
          questTask,
          contractInterface
        );

        if (isQuestCompleted) {
          Logger.debug(`Quest completed: ${txHash}`);
          await this.questRepository.completeQuest(id, address);
          return true;
        }
      }

      return false;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error while checking Quest: ${error.message}`
      );
    }
  }

  private async decodeTransaction(
    txHash: string,
    userAddress: string,
    questTask: QuestTask,
    contractInterface: ethers.Interface
  ): Promise<boolean> {
    try {
      const transaction = await provider.getTransaction(txHash);
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!transaction || !receipt) {
        Logger.error(`Txn not found: ${txHash}`);
        return false;
      }

      let isQuestCompleted = false;

      try {
        const parsedTransaction = contractInterface.parseTransaction({
          data: transaction.data,
          value: transaction.value,
        });

        if (
          parsedTransaction.name === 'multicall' &&
          questTask.id === 'quest7'
        ) {
          const rawTraceUrl = `https://soneium.blockscout.com/api/v2/transactions/${txHash}/raw-trace`;
          const resTrace = await fetch(rawTraceUrl, { method: 'GET' });

          if (!resTrace.ok) {
            Logger.error(
              `Error fetching raw trace from BlockScout: ${resTrace.statusText}`
            );
            return false;
          }

          const traceData = await resTrace.json();

          const innerCalls = traceData.calls;
          isQuestCompleted = await this.traverseCalls(
            innerCalls,
            questTask,
            txHash
          );
        } else {
          if (parsedTransaction.name === questTask.method) {
            if (
              await this.validateQuestConditions(parsedTransaction, questTask)
            ) {
              Logger.debug(
                `Method ${questTask.method} was called with correct params`
              );
              isQuestCompleted = true;
            }
          }

          if (
            questTask.methods &&
            questTask.methods.includes(parsedTransaction.name)
          ) {
            if (
              await this.validateQuestConditions(parsedTransaction, questTask)
            ) {
              Logger.debug(
                `Method ${parsedTransaction.name} was called with correct params`
              );
              isQuestCompleted = true;
            }
          }
        }
      } catch (err) {
        Logger.error(`Error while decoding txn ${txHash}: ${err.message}`);
      }

      if (!isQuestCompleted && receipt.logs.length > 0) {
        for (const log of receipt.logs) {
          try {
            const parsedLog = contractInterface.parseLog(log);

            if (
              parsedLog.name === questTask.event &&
              typeof log.address === 'string' &&
              log.address.toLowerCase() === questTask.contract.toLowerCase()
            ) {
              if (await this.validateLogConditions(parsedLog.args, questTask)) {
                Logger.debug(
                  `Event ${questTask.event} found, it means ${questTask.method} was called with correct params`
                );
                isQuestCompleted = true;
                break;
              }
            }
          } catch (err) {
            continue;
          }
        }
      }

      return isQuestCompleted;
    } catch (error) {
      Logger.error(`Error while decoding txn ${txHash}: ${error.message}`);
      return false;
    }
  }

  private async traverseCalls(
    calls: any[],
    questTask: QuestTask,
    txHash: string
  ): Promise<boolean> {
    for (const call of calls) {
      if (call.calls && Array.isArray(call.calls)) {
        const isCompleted = await this.traverseCalls(
          call.calls,
          questTask,
          txHash
        );
        if (isCompleted) {
          return true;
        }
      }

      if (
        call.type !== 'CALL' &&
        call.type !== 'DELEGATECALL' &&
        call.type !== 'STATICCALL'
      ) {
        continue;
      }

      const to = call.to;
      const input = call.input;
      const value = call.value;

      if (
        !to ||
        typeof to !== 'string' ||
        !input ||
        typeof input !== 'string'
      ) {
        continue;
      }

      const abi = this.contractAbiMap[to];
      if (!abi) {
        Logger.warn(`ABI not found for contract: ${to}`);
        continue;
      }

      const contractInterface = new ethers.Interface(abi);

      try {
        const parsedCall = contractInterface.parseTransaction({
          data: input,
          value: ethers.toBigInt(value),
        });

        if (questTask.methods && questTask.methods.includes(parsedCall.name)) {
          const isValid = await this.validateQuestConditions(
            parsedCall,
            questTask
          );
          if (isValid) {
            Logger.debug(
              `Method ${parsedCall.name} was called with correct params`
            );
            return true;
          }
        }
      } catch (err) {
        Logger.error(`Error parsing inner call data: ${err.message}`);
        continue;
      }
    }

    return false;
  }

  private extractAddressesFromPath(path: string): string[] {
    const addresses: string[] = [];
    const pathWithout0x = path.startsWith('0x') ? path.slice(2) : path;

    const addressLength = 40;
    const feeLength = 6;
    const stepLength = addressLength + feeLength;
    const numSteps = Math.floor(pathWithout0x.length / stepLength);

    for (let i = 0; i < numSteps; i++) {
      const start = i * stepLength;
      const end = start + addressLength;
      const address = '0x' + pathWithout0x.slice(start, end);
      if (ethers.isAddress(address)) {
        addresses.push(address.toLowerCase());
      }
    }

    const lastStart = numSteps * stepLength;
    if (lastStart + addressLength <= pathWithout0x.length) {
      const address =
        '0x' + pathWithout0x.slice(lastStart, lastStart + addressLength);
      if (ethers.isAddress(address)) {
        addresses.push(address.toLowerCase());
      }
    }

    return addresses;
  }

  private async validateQuestConditions(
    parsedTransaction: ethers.TransactionDescription,
    questTask: QuestTask
  ): Promise<boolean> {
    if (questTask.id === 'quest6') {
      const pathBytes: string = parsedTransaction.args.params.path;
      const pathAddresses = this.extractAddressesFromPath(pathBytes);
      const inputTokens = questTask.tokens.map((token) => token.toLowerCase());
      const hasAllTokens = inputTokens.every((token) =>
        pathAddresses.includes(token)
      );

      if (!hasAllTokens) {
        Logger.debug('Not all tokens are in swap pool');
        return false;
      }
      const amountIn = parsedTransaction.args.params.amountIn;
      const amountInETH = ethers.formatEther(amountIn);
      const usdAmount = await this.getUSDValue('ethereum', amountInETH);
      //TODO: switch if needed
      if (usdAmount < 0.5) {
        Logger.debug(`Sum of swap is less than needed: ${usdAmount} USD`);
        return false;
      }

      return true;
    }

    if (questTask.id === 'quest7') {
      const methods = questTask.methods || [];
      if (!methods.includes(parsedTransaction.name)) {
        return false;
      }

      const tokens = questTask.tokens.map((token) => token.toLowerCase());
      const args = parsedTransaction.args;

      const hasASTR = tokens.includes(
        '0x2cae934a1e84f693fbb78ca5ed3b0a6893259441'.toLowerCase()
      );
      if (!hasASTR) {
        Logger.debug('ASTR not found in logs');
        return false;
      }
      let liquidityAmount: string | undefined;

      if (args.amount) {
        liquidityAmount = args.amount.toString();
      } else if (args.amount0) {
        liquidityAmount = args.amount0.toString();
      } else if (args.amount1) {
        liquidityAmount = args.amount1.toString();
      } else if (args.value) {
        liquidityAmount = args.value.toString();
      } else {
        liquidityAmount = args[0][5].toString();
      }

      if (!liquidityAmount) {
        Logger.debug('liquidityAmount not found in logs');
        return false;
      }

      const liquidityAmountUSD = await this.getUSDValue(
        'astroport',
        ethers.formatUnits(liquidityAmount, 18)
      );
      //TODO: switch if needed
      if (liquidityAmountUSD < 0.1) {
        Logger.debug(
          `Sum of liquidity than it needed: ${liquidityAmountUSD} USD`
        );
        return false;
      }

      return true;
    }

    return false;
  }

  private async validateLogConditions(
    args: any,
    questTask: QuestTask
  ): Promise<boolean> {
    if (questTask.id === 'quest6') {
      return true;
    }

    if (questTask.id === 'quest7') {
      return true;
    }
    return false;
  }

  private async getUSDValue(token: string, amount: string): Promise<number> {
    try {
      const tokenId = this.tokenToCoingeckoId[token.toLowerCase()];
      if (!tokenId) {
        Logger.warn(`No CoinGecko ID found for token: ${token}`);
        return 0;
      }

      const currentTime = Date.now();
      const cacheEntry = this.priceCache[tokenId];
      const cacheTTL = 60 * 1000;

      if (cacheEntry && currentTime - cacheEntry.timestamp < cacheTTL) {
        return parseFloat(amount) * cacheEntry.price;
      }

      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=usd`
      );

      if (!response.ok) {
        Logger.error(
          `Error fetching price from CoinGecko: ${response.statusText}`
        );
        return 0;
      }

      const data = await response.json();
      const price = data[tokenId]?.usd;

      if (!price) {
        Logger.warn(`No price data found for token: ${tokenId}`);
        return 0;
      }

      this.priceCache[tokenId] = {
        price,
        timestamp: currentTime,
      };

      return parseFloat(amount) * price;
    } catch (error) {
      Logger.error(`Error in getUSDValue: ${error.message}`);
      return 0;
    }
  }

  async getQuestValue(id: string): Promise<any> {
    const quest: QuestType = await this.questRepository.getQuest(id);
    return quest.value;
  }
}
