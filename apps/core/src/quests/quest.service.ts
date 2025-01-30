import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { QuestRepository } from './quest.repository';
import { ethers } from 'ethers';
import { soneiumProvider, ethProvider } from '../shared/provider';
import fetch from 'node-fetch';
import { QuestTask, QuestType } from './interface';
import { UniswapV3ABI } from '../shared/abi/uniswapV3';
import { ArkadaAbi } from '../shared/abi/arkada';
import { SwapRouterABI } from '../shared/abi/swapRouter';
import { UserService } from '../user/user.service';
import { CampaignService } from '../campaigns/campaign.service';
import { PriceService } from '../price/price.service';
import { l2BridgeABI } from '../shared/abi/l2BridgeABI';
import { mintABI } from '../shared/abi/mintABI';

@Injectable()
export class QuestService {
  private readonly contractAbiMap: { [contractAddress: string]: any } = {
    '0xdef357d505690f1b0032a74c3b581163c23d1535': SwapRouterABI,
    '0x6f5f9d55f727928b644b04d987b1c0cf50af8c0b': UniswapV3ABI,
    '0xcC943afF0F3F8746CCbC3f54BB8869176dBb17F3': ArkadaAbi,
    '0xeb9bf100225c214efc3e7c651ebbadcf85177607': l2BridgeABI,
    '0x43a91c353620b18070ad70416f1667250a75daed': mintABI,
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
    private readonly campaignService: CampaignService,
    private readonly priceService: PriceService
  ) {}

  async getAllCompletedQuestsByUser(address: string) {
    return await this.questRepository.getAllCompletedQuestsByUser(address);
  }

  async getCompletedQuestsByUserInCampaign(
    campaignId: string,
    address: string
  ) {
    return await this.questRepository.getCompletedQuestsByUserInCampaign(
      campaignId,
      address
    );
  }
  async checkQuestCompletion(id: string, address: string) {
    return await this.questRepository.checkQuestCompletion(id, address);
  }

  async hasMintedNft(userAddress: string): Promise<boolean> {
    const contract = '0x43a91c353620b18070ad70416f1667250a75daed';
    try {
      const url = `https://soneium.blockscout.com/api?module=account&action=txlist&address=${userAddress}&startblock=0&endblock=latest&page=1&offset=500&sort=asc`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        return false;
      }

      const data = await res.json();

      if (data.status !== '1' || !Array.isArray(data.result)) {
        return false;
      }

      const transactions = data.result;
      const userTransactions = transactions.filter(
        (tx: any) =>
          tx.to &&
          tx.to.toLowerCase() === contract.toLowerCase() &&
          tx.from &&
          tx.from.toLowerCase() === userAddress.toLowerCase()
      );

      Logger.debug(
        `Txns for user ${userAddress} -> ${contract}: ${userTransactions.length}. `
      );
      const provider = soneiumProvider;
      for (const tx of userTransactions) {
        const txHash = tx.hash;
        const transaction = await provider.getTransaction(txHash);
        const receipt = await provider.getTransactionReceipt(txHash);

        if (!transaction || !receipt) {
          Logger.error(`Txn not found: ${txHash}`);
          return false;
        }
        const fallbackAbi = this.contractAbiMap[contract.toLowerCase()];
        let contractInterface: ethers.Interface | null = null;
        contractInterface = new ethers.Interface(fallbackAbi);

        let parsedTx: ethers.TransactionDescription;
        try {
          parsedTx = contractInterface.parseTransaction({
            data: transaction.data,
            value: transaction.value,
          });
        } catch (err) {
          Logger.debug(`parseTransaction error (top-level): ${err.message}`);
          return false;
        }
        if (parsedTx.name === 'mintNFT') {
          return true;
        } else {
          return false;
        }
      }

      return false;
    } catch (error) {
      Logger.error(`Error in hasMintedNft: ${error.message}`);
      throw error;
    }
  }

  async completeQuestQuiz(id: string, userAddress: string): Promise<boolean> {
    try {
      const isCompleted = await this.questRepository.checkQuestCompletion(
        id,
        userAddress
      );
      if (isCompleted) {
        return true;
      }
      const questStored: QuestType = await this.questRepository.getQuest(id);

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
      console.log('------>', 123123);
      for (let i = 0; i < currentQuestIndex; i++) {
        const priorQuest = allQuests[i];
        const isPriorQuestCompleted =
          await this.questRepository.checkQuestCompletion(
            priorQuest.id,
            userAddress
          );
        if (!isPriorQuestCompleted) {
          throw new BadRequestException(
            `Для выполнения этого квеста нужно сначала пройти: ${priorQuest.name}`
          );
        }
      }
      const lowerAddress = userAddress.toLowerCase();

      await this.questRepository.completeQuest(id, lowerAddress);
      try {
        const campaignId = questStored.campaign_id;

        const allCampaignQuests = allQuests;

        const completedQuests =
          await this.questRepository.getCompletedQuestsByUserInCampaign(
            campaignId,
            lowerAddress
          );
        if (completedQuests.length === allCampaignQuests.length) {
          const wasMarked = await this.campaignService.markCampaignAsCompleted(
            campaignId,
            lowerAddress
          );

          if (wasMarked) {
            const campaign = await this.campaignService.getCampaignByIdOrSlug(
              campaignId
            );
            const rewards = campaign.rewards; // [{ "type": "tokens", "value": "100" }, ...]

            let totalPoints = 0;
            rewards.forEach((reward: any) => {
              if (reward.type === 'tokens') {
                totalPoints += parseInt(reward.value, 10);
              }
            });

            await this.userService.updatePoints(lowerAddress, totalPoints);
          }
        }
      } catch (error) {
        throw new InternalServerErrorException(
          `Ошибка при завершении квеста и начислении баллов: ${error.message}`
        );
      }
      return true;
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

  async completeQuestAndAwardPoints(
    questId: string,
    userAddress: string
  ): Promise<void> {
    const lowerAddress = userAddress.toLowerCase();
    try {
      const quest = await this.questRepository.getQuest(questId);
      const campaignId = quest.campaign_id;

      const allCampaignQuests = await this.questRepository.getQuestsByCampaign(
        campaignId
      );

      const completedQuests =
        await this.questRepository.getCompletedQuestsByUserInCampaign(
          campaignId,
          lowerAddress
        );

      if (completedQuests.length === allCampaignQuests.length) {
        const wasMarked = await this.campaignService.markCampaignAsCompleted(
          campaignId,
          lowerAddress
        );

        if (wasMarked) {
          const campaign = await this.campaignService.getCampaignByIdOrSlug(
            campaignId
          );
          const rewards = campaign.rewards; // [{ "type": "tokens", "value": "100" }, ...]

          let totalPoints = 0;
          rewards.forEach((reward: any) => {
            if (reward.type === 'tokens') {
              totalPoints += parseInt(reward.value, 10);
            }
          });

          await this.userService.updatePoints(lowerAddress, totalPoints);
        }
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
            `Для выполнения этого квеста нужно сначала пройти: ${priorQuest.name}`
          );
        }
      }

      let url: string | undefined;
      console.log('------>', questTask.chain.trim());
      if (questTask.chain === 'Soneium') {
        url = `https://soneium.blockscout.com/api?module=account&action=txlist&address=${address}&startblock=0&endblock=latest&page=1&offset=500&sort=asc`;
      }
      if (questTask.chain === 'Ethereum') {
        url = `https://eth.blockscout.com/api?module=account&action=txlist&address=${address}&startblock=0&endblock=latest&page=1&offset=500&sort=asc`;
      }
      console.log('------>', url);

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
          tx.to.toLowerCase() === questTask.contract.toLowerCase() &&
          tx.from &&
          tx.from.toLowerCase() === address.toLowerCase()
      );

      Logger.debug(
        `Txns for user ${address} -> ${questTask.contract}: ${userTransactions.length}. `
      );

      for (const tx of userTransactions) {
        const txHash = tx.hash;
        const isQuestDone = await this.decodeTransaction(
          txHash,
          questTask,
          address
        );

        if (isQuestDone) {
          Logger.debug(`Quest completed by tx: ${txHash}`);
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
    questTask: QuestTask,
    address: string
  ): Promise<boolean> {
    try {
      const provider =
        questTask.chain === 'Soneium' ? soneiumProvider : ethProvider;
      const transaction = await provider.getTransaction(txHash);
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!transaction || !receipt) {
        Logger.error(`Txn not found: ${txHash}`);
        return false;
      }
      const fallbackAbi = this.contractAbiMap[questTask.contract.toLowerCase()];
      let contractInterface: ethers.Interface | null = null;
      contractInterface = new ethers.Interface(fallbackAbi);

      let parsedTx: ethers.TransactionDescription;
      try {
        parsedTx = contractInterface.parseTransaction({
          data: transaction.data,
          value: transaction.value,
        });
      } catch (err) {
        Logger.debug(`parseTransaction error (top-level): ${err.message}`);
        return false;
      }

      Logger.debug(`Top-level method: ${parsedTx.name}`);

      if (parsedTx.name === 'multicall') {
        const rawTraceUrl = `https://soneium.blockscout.com/api/v2/transactions/${txHash}/raw-trace`;
        const resTrace = await fetch(rawTraceUrl, { method: 'GET' });
        if (!resTrace.ok) {
          Logger.error(
            `Error fetching raw trace: ${resTrace.status} / ${resTrace.statusText}`
          );
          return false;
        }

        const traceData = await resTrace.json();
        const topCalls = traceData.calls || [];
        const isOk = await this.traverseMulticall(topCalls, questTask);
        return isOk;
      } else {
        return await this.decodeSingleTransaction(parsedTx, questTask, address);
      }
    } catch (error) {
      Logger.error(`decodeTransaction error: ${error.message}`);
      return false;
    }
  }

  private async traverseMulticall(
    calls: any[],
    questTask: QuestTask
  ): Promise<boolean> {
    let contractInterface: ethers.Interface;
    if (questTask.abi_to_find && Array.isArray(questTask.abi_to_find)) {
      contractInterface = new ethers.Interface(questTask.abi_to_find);
    } else {
      contractInterface = new ethers.Interface([]);
    }

    for (const call of calls) {
      if (call.calls && Array.isArray(call.calls)) {
        const isFoundInNested = await this.traverseMulticall(
          call.calls,
          questTask
        );
        if (isFoundInNested) {
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

      const toAddress = call.to;
      const inputData = call.input;
      const valueHex = call.value;
      console.log('------>', questTask);
      if (!toAddress || !inputData) {
        continue;
      }

      let parsedCall: ethers.TransactionDescription;
      try {
        parsedCall = contractInterface.parseTransaction({
          data: inputData,
          value: ethers.toBigInt(valueHex),
        });
      } catch (err) {
        Logger.debug(`parseTransaction error: ${err.message}`);
        continue;
      }

      if (parsedCall && parsedCall.name && parsedCall.name === 'multicall') {
        if (call.calls && Array.isArray(call.calls)) {
          const subCheck = await this.traverseMulticall(call.calls, questTask);
          if (subCheck) return true;
        }
        continue;
      }
      if (!parsedCall) {
        if (call.calls && Array.isArray(call.calls)) {
          const subCheck = await this.traverseMulticall(call.calls, questTask);
          if (subCheck) return true;
        }
        continue;
      }

      const isOk = await this.decodeSingleTransaction(parsedCall, questTask);
      if (isOk) {
        return true;
      }
    }

    return false;
  }

  private async decodeSingleTransaction(
    parsedTx: ethers.TransactionDescription,
    questTask: QuestTask,
    address?: string
  ): Promise<boolean> {
    const isValid = await this.validateAbiEquals(parsedTx, questTask);
    if (!isValid) {
      return false;
    }

    if (parsedTx.name === 'mint') {
      const params = parsedTx.args[0];
      if (!params) return false;

      const token0 = params.token0?.toLowerCase();
      const token1 = params.token1?.toLowerCase();

      const ASTR_ADDRESS = '0x2cae934a1e84f693fbb78ca5ed3b0a6893259441';
      const SECOND_ADDRESS = questTask.abi_equals[0][1];
      if (token0 !== ASTR_ADDRESS && token1 !== ASTR_ADDRESS) {
        Logger.debug(`Ни token0, ни token1 не равен ASTR`);
        return false;
      }

      const amount0Desired = params.amount0Desired || 0;
      const amount1Desired = params.amount1Desired || 0;

      let astrAmountBN = null;
      let ethAmountBN = null;
      if (token0 === ASTR_ADDRESS) {
        astrAmountBN = amount0Desired;
      }
      if (token1 === SECOND_ADDRESS) {
        ethAmountBN = amount1Desired;
      }

      if (!astrAmountBN) {
        Logger.debug(`Не нашли amount, соответствующий ASTR`);
        return false;
      }

      console.log('------>', astrAmountBN, ethAmountBN);

      const astrAmount = ethers.formatUnits(astrAmountBN, 18);
      const ethAmount = ethers.formatUnits(ethAmountBN, 18);

      const astrUSDValue = await this.getUSDValue('astroport', astrAmount);
      const ethUSDValue = await this.getUSDValue('ethereum', ethAmount);

      const totalValue = astrUSDValue + +ethUSDValue;

      Logger.debug(`USD value: ${totalValue}`);
      if (totalValue < (questTask.minAmountUSD || 20)) {
        Logger.debug(
          `Сумма ASTR в ликвидности (${totalValue} USD) меньше, чем нужно (${questTask.minAmountUSD} USD)`
        );
        return false;
      }

      return true;
    }

    if (parsedTx.name === 'bridgeETHTo') {
      const tokenAddr = parsedTx.args[0]?.toLowerCase();
      // const amountBN = parsedTx.args[1];

      if (tokenAddr === address.toLowerCase()) {
        return true;
      }
      return false;
    }

    if (parsedTx.args?.length > 0) {
      const firstArg = parsedTx.args[0];
      if (Array.isArray(firstArg) && firstArg.length > 0) {
        const pathBytes = firstArg[0];
        if (typeof pathBytes === 'string' && pathBytes.startsWith('0x')) {
          const pathAddresses = this.extractAddressesFromPath(pathBytes);
          Logger.debug(`Path addresses: ${pathAddresses}`);
        }
      }
    }

    if (questTask.minAmountUSD) {
      const firstArg = parsedTx.args[0];
      if (Array.isArray(firstArg)) {
        const amountIn = firstArg[firstArg.length - 2];
        if (amountIn) {
          const amountInETH = ethers.formatEther(amountIn);
          const usdAmount = await this.getUSDValue('ethereum', amountInETH);
          if (usdAmount < questTask.minAmountUSD) {
            Logger.debug(
              `Сумма свапа (${usdAmount}) меньше требуемого минимума (${questTask.minAmountUSD} USD)`
            );
            return false;
          }
          Logger.debug(
            `Сумма свапа (${usdAmount}) больше требуемого минимума (${questTask.minAmountUSD} USD)`
          );
          return true;
        }
      }
    }
  }

  private async validateAbiEquals(
    parsedTx: ethers.TransactionDescription,
    questTask: QuestTask
  ): Promise<boolean> {
    if (!questTask.abi_equals || !Array.isArray(questTask.abi_equals)) {
      return true;
    }

    // console.log('------>', questTask.abi_equals);
    // console.log('404------>', parsedTx);
    const realArgs = Array.from(parsedTx.args || []);

    // console.log('-realArgs----->', realArgs);
    // Logger.debug(`Real args: ${JSON.stringify(realArgs)}`);

    for (const conditionArr of questTask.abi_equals) {
      // console.log('------>', 7777777);
      let isConditionMatched = true;
      for (let i = 0; i < conditionArr.length; i++) {
        const expected = conditionArr[i];
        // console.log('-----expected->', expected);
        if (expected === 0 || expected === undefined) {
          continue;
        }

        if (typeof expected === 'string') {
          // console.log('--realArgs[i]---->', realArgs[i]);
          if (
            !realArgs[0][i] ||
            realArgs[0][i].toLowerCase() !== expected.toLowerCase()
          ) {
            isConditionMatched = false;
            break;
          }
        } else {
          if (realArgs[0][i].toString() !== expected.toString()) {
            isConditionMatched = false;
            break;
          }
        }
      }

      if (isConditionMatched) {
        Logger.debug(`Сошлось по условию: ${JSON.stringify(conditionArr)}`);
        return true;
      }
    }

    return false;
  }

  // private async decodeTransaction(
  //   txHash: string,
  //   userAddress: string,
  //   questTask: QuestTask,
  //   contractInterface: ethers.Interface
  // ): Promise<boolean> {
  //   try {
  //     const transaction = await provider.getTransaction(txHash);
  //     const receipt = await provider.getTransactionReceipt(txHash);

  //     if (!transaction || !receipt) {
  //       Logger.error(`Txn not found: ${txHash}`);
  //       return false;
  //     }

  //     let isQuestCompleted = false;

  //     try {
  //       const parsedTransaction = contractInterface.parseTransaction({
  //         data: transaction.data,
  //         value: transaction.value,
  //       });

  //       if (
  //         parsedTransaction.name === 'multicall' &&
  //         questTask.id === 'quest7'
  //       ) {
  //         const rawTraceUrl = `https://soneium.blockscout.com/api/v2/transactions/${txHash}/raw-trace`;
  //         const resTrace = await fetch(rawTraceUrl, { method: 'GET' });

  //         if (!resTrace.ok) {
  //           Logger.error(
  //             `Error fetching raw trace from BlockScout: ${resTrace.statusText}`
  //           );
  //           return false;
  //         }

  //         const traceData = await resTrace.json();

  //         const innerCalls = traceData.calls;
  //         isQuestCompleted = await this.traverseCalls(
  //           innerCalls,
  //           questTask,
  //           txHash
  //         );
  //       } else {
  //         if (parsedTransaction.name === questTask.method) {
  //           if (
  //             await this.validateQuestConditions(parsedTransaction, questTask)
  //           ) {
  //             Logger.debug(
  //               `Method ${questTask.method} was called with correct params`
  //             );
  //             isQuestCompleted = true;
  //           }
  //         }

  //         if (
  //           questTask.methods &&
  //           questTask.methods.includes(parsedTransaction.name)
  //         ) {
  //           if (
  //             await this.validateQuestConditions(parsedTransaction, questTask)
  //           ) {
  //             Logger.debug(
  //               `Method ${parsedTransaction.name} was called with correct params`
  //             );
  //             isQuestCompleted = true;
  //           }
  //         }
  //       }
  //     } catch (err) {
  //       Logger.error(`Error while decoding txn ${txHash}: ${err.message}`);
  //     }

  //     if (!isQuestCompleted && receipt.logs.length > 0) {
  //       for (const log of receipt.logs) {
  //         try {
  //           const parsedLog = contractInterface.parseLog(log);

  //           if (
  //             parsedLog.name === questTask.event &&
  //             typeof log.address === 'string' &&
  //             log.address.toLowerCase() === questTask.contract.toLowerCase()
  //           ) {
  //             if (await this.validateLogConditions(parsedLog.args, questTask)) {
  //               Logger.debug(
  //                 `Event ${questTask.event} found, it means ${questTask.method} was called with correct params`
  //               );
  //               isQuestCompleted = true;
  //               break;
  //             }
  //           }
  //         } catch (err) {
  //           continue;
  //         }
  //       }
  //     }

  //     return isQuestCompleted;
  //   } catch (error) {
  //     Logger.error(`Error while decoding txn ${txHash}: ${error.message}`);
  //     return false;
  //   }
  // }

  // private async traverseCalls(
  //   calls: any[],
  //   questTask: QuestTask,
  //   txHash: string
  // ): Promise<boolean> {
  //   for (const call of calls) {
  //     if (call.calls && Array.isArray(call.calls)) {
  //       const isCompleted = await this.traverseCalls(
  //         call.calls,
  //         questTask,
  //         txHash
  //       );
  //       if (isCompleted) {
  //         return true;
  //       }
  //     }

  //     if (
  //       call.type !== 'CALL' &&
  //       call.type !== 'DELEGATECALL' &&
  //       call.type !== 'STATICCALL'
  //     ) {
  //       continue;
  //     }

  //     const to = call.to;
  //     const input = call.input;
  //     const value = call.value;

  //     if (
  //       !to ||
  //       typeof to !== 'string' ||
  //       !input ||
  //       typeof input !== 'string'
  //     ) {
  //       continue;
  //     }

  //     const abi = this.contractAbiMap[to];
  //     if (!abi) {
  //       Logger.warn(`ABI not found for contract: ${to}`);
  //       continue;
  //     }

  //     const contractInterface = new ethers.Interface(abi);

  //     try {
  //       const parsedCall = contractInterface.parseTransaction({
  //         data: input,
  //         value: ethers.toBigInt(value),
  //       });

  //       if (questTask.methods && questTask.methods.includes(parsedCall.name)) {
  //         const isValid = await this.validateQuestConditions(
  //           parsedCall,
  //           questTask
  //         );
  //         if (isValid) {
  //           Logger.debug(
  //             `Method ${parsedCall.name} was called with correct params`
  //           );
  //           return true;
  //         }
  //       }
  //     } catch (err) {
  //       Logger.error(`Error parsing inner call data: ${err.message}`);
  //       continue;
  //     }
  //   }

  //   return false;
  // }

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

  // private async validateQuestConditions(
  //   parsedTransaction: ethers.TransactionDescription,
  //   questTask: QuestTask
  // ): Promise<boolean> {
  //   if (questTask.id === 'quest6') {
  //     const pathBytes: string = parsedTransaction.args.params.path;
  //     const pathAddresses = this.extractAddressesFromPath(pathBytes);
  //     const inputTokens = questTask.tokens.map((token) => token.toLowerCase());
  //     const hasAllTokens = inputTokens.every((token) =>
  //       pathAddresses.includes(token)
  //     );

  //     if (!hasAllTokens) {
  //       Logger.debug('Not all tokens are in swap pool');
  //       return false;
  //     }
  //     const amountIn = parsedTransaction.args.params.amountIn;
  //     const amountInETH = ethers.formatEther(amountIn);
  //     const usdAmount = await this.getUSDValue('ethereum', amountInETH);
  //     Logger.debug('------>', usdAmount);
  //     if (usdAmount < 0.5) {
  //       Logger.debug(`Sum of swap is less than needed: ${usdAmount} USD`);
  //       return false;
  //     }

  //     return true;
  //   }

  //   if (questTask.id === 'quest7') {
  //     const methods = questTask.methods || [];
  //     if (!methods.includes(parsedTransaction.name)) {
  //       return false;
  //     }

  //     const tokens = questTask.tokens.map((token) => token.toLowerCase());
  //     const args = parsedTransaction.args;

  //     const hasASTR = tokens.includes(
  //       '0x2cae934a1e84f693fbb78ca5ed3b0a6893259441'.toLowerCase()
  //     );

  //     const hasETH = tokens.includes(
  //       '0x4200000000000000000000000000000000000006'.toLowerCase()
  //     );
  //     if (!hasASTR || !hasETH) {
  //       Logger.debug('ASTR or ETH not found in logs');
  //       return false;
  //     }
  //     let liquidityAmount: string | undefined;

  //     if (args.amount) {
  //       liquidityAmount = args.amount.toString();
  //     } else if (args.amount0) {
  //       liquidityAmount = args.amount0.toString();
  //     } else if (args.amount1) {
  //       liquidityAmount = args.amount1.toString();
  //     } else if (args.value) {
  //       liquidityAmount = args.value.toString();
  //     } else {
  //       liquidityAmount = args[0][5].toString();
  //     }

  //     if (!liquidityAmount) {
  //       Logger.debug('liquidityAmount not found in logs');
  //       return false;
  //     }

  //     const liquidityAmountUSD = await this.getUSDValue(
  //       'astroport',
  //       ethers.formatUnits(liquidityAmount, 18)
  //     );
  //     console.log('------>', liquidityAmountUSD);
  //     //TODO: switch if needed
  //     if (liquidityAmountUSD < 0.1) {
  //       Logger.debug(
  //         `Sum of liquidity than it needed: ${liquidityAmountUSD} USD`
  //       );
  //       return false;
  //     }

  //     return true;
  //   }

  //   return false;
  // }

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

      const price = await this.priceService.getTokenPrice(tokenId);

      if (!price) {
        Logger.warn(`No price data found for token: ${tokenId}`);
        return 0;
      }

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

  async getQuest(id: string): Promise<QuestType> {
    const quest: QuestType = await this.questRepository.getQuest(id);
    return quest;
  }
}
