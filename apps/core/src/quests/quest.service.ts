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
import { newAbi } from '../shared/abi/newAbi';
import { UniswapV3PoolABI } from '../shared/abi/uniswapV3Pool';
import { randomABI } from '../shared/abi/idk';
import { MintNewABI } from '../shared/abi/mintNew';
import { VaultABI } from '../shared/abi/vault-buy-execution';
import { buyABI } from '../shared/abi/newXd';

@Injectable()
export class QuestService {
  private readonly contractAbiMap: { [contractAddress: string]: any } = {
    '0xdef357d505690f1b0032a74c3b581163c23d1535': SwapRouterABI,
    '0x6f5f9d55f727928b644b04d987b1c0cf50af8c0b': UniswapV3ABI,
    '0xcC943afF0F3F8746CCbC3f54BB8869176dBb17F3': ArkadaAbi,
    '0xeb9bf100225c214efc3e7c651ebbadcf85177607': l2BridgeABI,
    '0x43a91c353620b18070ad70416f1667250a75daed': mintABI,
    '0xae2b32e603d303ed120f45b4bc2ebac314de080b': newAbi,
    '0xe15bd143d36e329567ae9a176682ab9fafc9c3d2': UniswapV3PoolABI,
    '0x34834f208f149e0269394324c3f19e06df2ca9cb': randomABI,
    '0x39df84267fda113298d4794948b86026efd47e32': MintNewABI,
    '0x580DD7a2CfC523347F15557ad19f736F74D5677c': VaultABI,
    '0x1c5d80edb12341dca11f4500aa67b4d2238f3220': buyABI,
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
    try {
      const contractAddress = '0x39df84267fda113298d4794948b86026efd47e32';

      const minimalAbi = ['function hasMinted(address) view returns (bool)'];

      const contract = new ethers.Contract(
        contractAddress,
        minimalAbi,
        soneiumProvider
      );

      const minted = await contract.hasMinted(userAddress);
      Logger.debug(`hasMinted(${userAddress}) => ${minted}`);

      return minted;
    } catch (error) {
      Logger.error(`Ошибка при вызове hasMinted: ${error.message}`);
      return false;
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

      if (questStored.sequence === 1) {
        await this.campaignService.incrementParticipants(
          questStored.campaign_id
        );
        Logger.debug(
          `Campaign ${questStored.campaign_id}: participants incremented for first quest.`
        );
      }

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

            await this.userService.awardCampaignCompletion(
              lowerAddress,
              totalPoints
            );
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
          await this.userService.awardCampaignCompletion(
            lowerAddress,
            +totalPoints
          );
        }
      }
    } catch (error) {
      throw new InternalServerErrorException(
        `Ошибка при завершении квеста и начислении баллов: ${error.message}`
      );
    }
  }
  private createBlockscoutUrl(chain: string, address: string): string {
    let baseUrl = 'https://soneium.blockscout.com';
    if (chain === 'Soneium') {
      baseUrl = 'https://soneium.blockscout.com';
    } else if (chain === 'Ethereum') {
      return 'https://soneium.blockscout.com/api?module=account&action=eth_get_balance&address=';
    } else {
      throw new Error(`Unsupported chain: ${chain}`);
    }

    const nowUnix = Math.floor(Date.now() / 1000);
    const weekAgoUnix = nowUnix - 30 * 24 * 60 * 60;

    const queryParams = new URLSearchParams({
      module: 'account',
      action: 'txlist',
      address: address,
      start_timestamp: weekAgoUnix.toString(),
      end_timestamp: nowUnix.toString() + 1000,
      page: '0',
      offset: '500',
      sort: 'desc',
      // filter_by: 'from',
    });

    return `${baseUrl}/api?${queryParams.toString()}`;
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

      if (questStored.type === 'link') {
        if (questTask.contract) {
          try {
            const contractAddress = questTask.contract;

            const minimalAbi = [
              'function hasMinted(address) view returns (bool)',
            ];

            const contract = new ethers.Contract(
              contractAddress,
              minimalAbi,
              soneiumProvider
            );

            const minted = await contract.hasMinted(address);
            Logger.debug(`hasMinted(${address}) => ${minted}`);

            if (minted) {
              await this.questRepository.completeQuest(id, address);
              if (questStored.sequence === 1) {
                await this.campaignService.incrementParticipants(
                  questStored.campaign_id
                );
                Logger.debug(
                  `Campaign ${questStored.campaign_id}: participants incremented for first quest.`
                );
              }
              return true;
            }
          } catch (error) {
            Logger.error(`Ошибка при вызове hasMinted: ${error.message}`);
            return false;
          }
          return false;
        }
        if (questTask.params) {
          const finalUrl = this.buildLinkUrl(
            questTask.endpoint,
            questTask.params,
            address
          );
          Logger.debug(`Requesting link quest with URL: ${finalUrl}`);
          const res = await fetch(finalUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          if (!res.ok) {
            throw new InternalServerErrorException(
              `Error while requesting link endpoint: ${res.statusText}`
            );
          }

          const data = await res.json();
          Logger.debug(`Link quest data: ${JSON.stringify(data)}`);
          if (data.verified) {
            await this.questRepository.completeQuest(id, address);
            if (questStored.sequence === 1) {
              await this.campaignService.incrementParticipants(
                questStored.campaign_id
              );
              Logger.debug(
                `Campaign ${questStored.campaign_id}: participants incremented for first quest.`
              );
            }
            return true;
          }
          return false;
        }

        const endpoint = questTask.endpoint.replace('{$address}', address);
        Logger.debug(`Link quest endpoint: ${endpoint}`);
        const res = await fetch(endpoint, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
          throw new InternalServerErrorException(
            `Error while requesting link endpoint: ${res.statusText}`
          );
        }
        const data = await res.json();
        Logger.debug(`Link quest data: ${JSON.stringify(data)}`);

        const exprFn = new Function(
          'data',
          `return (${questTask.expression})(data);`
        );
        const result = exprFn(data);
        Logger.debug(`Link quest expression result: ${result}`);
        if (result === 1 || result === true) {
          await this.questRepository.completeQuest(id, address);
          if (questStored.sequence === 1) {
            await this.campaignService.incrementParticipants(
              questStored.campaign_id
            );
            Logger.debug(
              `Campaign ${questStored.campaign_id}: participants incremented for first quest.`
            );
          }
          return true;
        } else {
          return false;
        }
      }

      const ifCaseMethod414a = questTask.abi_to_find.filter(
        (sig) => sig === '0x414a8809'
      );
      if (ifCaseMethod414a.length > 0) {
        const url =
          'https://soneium.blockscout.com/api?module=token&action=getTokenHolders&contractaddress=0x963c039406F8b10D3a0691328B4d2AE90FA43230&page=1&offset=10000';

        const resTrace = await fetch(url, { method: 'GET' });
        if (!resTrace.ok) {
          Logger.error(
            `Error fetching balance: ${resTrace.status} / ${resTrace.statusText}`
          );
          return false;
        }

        const data = await resTrace.json();
        console.log('------>', data);
        if (!data || !data.result) {
          Logger.error('Invalid balance response');
          return false;
        }
        for (const user of data.result) {
          try {
            if (user.address.toLowerCase() === address.toLowerCase()) {
              await this.questRepository.completeQuest(id, address);
              if (questStored.sequence === 1) {
                await this.campaignService.incrementParticipants(
                  questStored.campaign_id
                );
              }
              return true;
            }
          } catch (error) {
            Logger.error(`Ошибка обработки транзакции: ${error.message}`);
            continue;
          }
        }
        return false;
      }

      const url = this.createBlockscoutUrl(questTask.chain, address);
      if (questTask.chain === 'Ethereum') {
        const urlR = url + `${address}`;
        const resTrace = await fetch(urlR, { method: 'GET' });
        if (!resTrace.ok) {
          Logger.error(
            `Error fetching balance: ${resTrace.status} / ${resTrace.statusText}`
          );
          return false;
        }

        const data = await resTrace.json();
        if (!data || !data.result) {
          Logger.error('Invalid balance response');
          return false;
        }

        const balance = ethers.getBigInt(data.result);
        Logger.debug(`Balance for ${address}: ${balance.toString()}`);

        if (balance > 0) {
          await this.questRepository.completeQuest(id, address);
          if (questStored.sequence === 1) {
            await this.campaignService.incrementParticipants(
              questStored.campaign_id
            );
            Logger.debug(
              `Campaign ${questStored.campaign_id}: participants incremented for first quest.`
            );
          }
          return true;
        } else {
          return false;
        }
      }
      Logger.debug(url);
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

      if (!Array.isArray(data.result)) {
        throw new BadRequestException('Incorrect response from BS API');
      }

      const transactions = data.result;
      const userTransactions = transactions.filter((tx: any) => {
        if (!tx.to) return false;

        const toAddr = tx.to.toLowerCase();
        const fromAddr = tx.from?.toLowerCase();
        const mainContract = questTask.contract.toLowerCase();
        const altContract = questTask.contract1?.toLowerCase();

        if (altContract) {
          return (
            (toAddr === mainContract || toAddr === altContract) &&
            fromAddr === address.toLowerCase()
          );
        } else {
          return toAddr === mainContract && fromAddr === address.toLowerCase();
        }
      });

      Logger.debug(`Txns found for user: ${userTransactions.length}`);
      const ifCaseSupply = questTask.abi_to_find.filter((el) =>
        el.includes('function supply')
      );

      if (ifCaseSupply.length > 0) {
        for (const el of userTransactions) {
          try {
            const supplyABI = [
              'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
            ];
            const supplyInterface = new ethers.Interface(supplyABI);

            let parsedSupply;
            try {
              parsedSupply = supplyInterface.parseTransaction({
                data: el.input,
              });
            } catch (e) {
              Logger.debug(`Ошибка парсинга supply: ${e.message}`);
              continue;
            }
            if (!parsedSupply) continue;
            Logger.debug('Parsed supply transaction:', parsedSupply);

            const asset = parsedSupply.args[0]?.toLowerCase();
            const amountBN: bigint = parsedSupply.args[1];

            const ASTR_ADDRESS =
              '0x2cae934a1e84f693fbb78ca5ed3b0a6893259441'.toLowerCase();
            if (asset !== ASTR_ADDRESS) {
              Logger.debug(
                `Asset ${asset} не соответствует ожидаемому ${ASTR_ADDRESS}`
              );
              continue;
            }

            const depositAmount = ethers.formatUnits(amountBN, 18);
            Logger.debug(`Deposit amount (raw): ${depositAmount}`);

            const depositUSDValue = await this.getUSDValue(
              'astroport',
              depositAmount
            );
            Logger.debug(`Deposit USD value: ${depositUSDValue}`);

            if (depositUSDValue >= (questTask.minAmountUSD || 20)) {
              await this.questRepository.completeQuest(id, address);
              if (questStored.sequence === 1) {
                await this.campaignService.incrementParticipants(
                  questStored.campaign_id
                );
                Logger.debug(
                  `Campaign ${questStored.campaign_id}: participants incremented for first quest.`
                );
              }
              return true;
            }
          } catch (error) {
            Logger.error(`Ошибка обработки транзакции: ${error.message}`);
            continue;
          }
        }
        return false;
      }

      const ifCaseBorrow = questTask.abi_to_find.filter((el) =>
        el.includes('function borrow')
      );

      if (ifCaseBorrow.length > 0) {
        for (const el of userTransactions) {
          try {
            const borrowABI = [
              'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)',
            ];
            const borrowInterface = new ethers.Interface(borrowABI);

            let parsedBorrow;
            try {
              parsedBorrow = borrowInterface.parseTransaction({
                data: el.input,
              });
            } catch (e) {
              Logger.debug(`Ошибка парсинга borrow: ${e.message}`);
              continue;
            }
            if (!parsedBorrow) continue;
            Logger.debug('Parsed borrow transaction:', parsedBorrow);

            const asset = parsedBorrow.args[0]?.toLowerCase();
            const amountBN: bigint = parsedBorrow.args[1];

            const USDC_ADDRESS =
              '0xbA9986D2381edf1DA03B0B9c1f8b00dc4AacC369'.toLowerCase();
            if (asset !== USDC_ADDRESS) {
              Logger.debug(
                `Asset ${asset} не соответствует ожидаемому ${USDC_ADDRESS}`
              );
              continue;
            }

            const borrowAmount = ethers.formatUnits(amountBN, 6);
            Logger.debug(`Borrow amount (raw): ${borrowAmount} USDC`);

            const minThreshold = questTask.minAmountUSD || 0;
            if (parseFloat(borrowAmount) >= minThreshold) {
              await this.questRepository.completeQuest(id, address);
              if (questStored.sequence === 1) {
                await this.campaignService.incrementParticipants(
                  questStored.campaign_id
                );
                Logger.debug(
                  `Campaign ${questStored.campaign_id}: participants incremented for first quest.`
                );
              }
              return true;
            }
          } catch (error) {
            Logger.error(`Ошибка обработки транзакции: ${error.message}`);
            continue;
          }
        }
        return false;
      }

      const ifCaseDeposit = questTask.abi_to_find.filter((el) =>
        el.includes('createDeposit')
      );
      const ifCaseSwap = questTask.abi_to_find.filter((el) =>
        el.includes('swapExactETHForTokens')
      );

      if (ifCaseDeposit.length > 0 || ifCaseSwap.length > 0) {
        for (const tx of userTransactions) {
          try {
            for (const abiItem of questTask.abi_to_find) {
              const iface = new ethers.Interface([abiItem]);
              const parsed = iface.parseTransaction({ data: tx.input });
              if (!parsed) continue;

              if (parsed.name === 'swapExactETHForTokens') {
                const amountOutMinBN = parsed.args[0] as bigint;
                const path = parsed.args[1] as string[];
                const outMinASTR = ethers.formatUnits(amountOutMinBN, 18);
                const usdValue = await this.getUSDValue(
                  'astroport',
                  outMinASTR
                );
                if (usdValue >= (questTask.minAmountUSD || 5)) {
                  await this.questRepository.completeQuest(id, address);
                  if (questStored.sequence === 1) {
                    await this.campaignService.incrementParticipants(
                      questStored.campaign_id
                    );
                    Logger.debug(
                      `Campaign ${questStored.campaign_id}: participants incremented for first quest.`
                    );
                  }
                  return true;
                }
              } else if (parsed.name === 'createDeposit') {
                const poolToken = parsed.args[0] as string;
                const token = (parsed.args[1] as string).toLowerCase();
                const amountBN = parsed.args[2] as bigint;
                const deposit = ethers.formatUnits(amountBN, 6);
                if (token === '0xba9986d2381edf1da03b0b9c1f8b00dc4aacc369') {
                  const usdValue = parseFloat(deposit);
                  if (usdValue >= (questTask.minAmountUSD || 10)) {
                    await this.questRepository.completeQuest(id, address);
                    if (questStored.sequence === 1) {
                      await this.campaignService.incrementParticipants(
                        questStored.campaign_id
                      );
                      Logger.debug(
                        `Campaign ${questStored.campaign_id}: participants incremented for first quest.`
                      );
                    }
                    return true;
                  }
                }
              }
            }
          } catch (err) {
            Logger.debug(`Ошибка парсинга: ${err.message}`);
            continue;
          }
        }
        return false;
      }

      // const ifCaseMethod414a = questTask.abi_to_find.filter(
      //   (sig) => sig === '0x414a8809'
      // );
      // if (ifCaseMethod414a.length > 0) {
      //   for (const tx of userTransactions) {
      //     try {
      //       if (tx.input.startsWith('0x414a8809')) {
      //         await this.questRepository.completeQuest(id, address);
      //         if (questStored.sequence === 1) {
      //           await this.campaignService.incrementParticipants(
      //             questStored.campaign_id
      //           );
      //         }
      //         return true;
      //       }
      //     } catch (error) {
      //       Logger.error(`Ошибка обработки транзакции: ${error.message}`);
      //       continue;
      //     }
      //   }
      //   return false;
      // }

      const ifCaseBuy = questTask.abi_to_find.filter((el) =>
        el.includes('function buy')
      );
      if (ifCaseBuy.length > 0) {
        for (const tx of userTransactions) {
          try {
            if (
              tx.input.startsWith('0xac9650d8') &&
              tx.input
                .toLowerCase()
                .includes(
                  '2CAE934a1e84F693fbb78CA5ED3B0A6893259441'.toLowerCase()
                )
            ) {
              await this.questRepository.completeQuest(id, address);
              await this.campaignService.incrementParticipants(
                questStored.campaign_id
              );
              Logger.debug(
                `Campaign ${questStored.campaign_id}: participants incremented for first quest.`
              );
              return true;
            }
            const multicallABI = ['function multicall(bytes[] data)'];
            const mcInterface = new ethers.Interface(multicallABI);

            const topParsed = mcInterface.parseTransaction(tx.input);

            return false;
          } catch (error) {
            Logger.error(`Ошибка обработки транзакции: ${error.message}`);
            continue;
          }
        }

        return false;
      }

      Logger.debug(
        `Txns for user ${address} -> ${questTask.contract}: ${userTransactions.length}. `
      );
      const ifCase = questTask.abi_to_find.filter((el) =>
        el.includes('function mint')
      );

      if (ifCase.length > 0) {
        for (const el of userTransactions) {
          try {
            const multicallABI = ['function multicall(bytes[] data)'];
            const mcInterface = new ethers.Interface(multicallABI);
            let topParsed;
            if (el.method || el.input.startsWith('0xac9650d8')) {
              try {
                topParsed = mcInterface.parseTransaction({ data: el.input });
              } catch (e) {
                Logger.debug(`Ошибка парсинга multicall: ${e.message}`);
                continue;
              }
              if (!topParsed) continue;
            } else {
              const parsed = this.parseMintManual(el.input);
              const token0 = parsed.token0.toLowerCase();
              const token1 = parsed.token1.toLowerCase();
              const ASTR_ADDRESS = '0x2cae934a1e84f693fbb78ca5ed3b0a6893259441';
              const SECOND_ADDRESS = questTask.abi_equals[0][1];

              if (token0 !== ASTR_ADDRESS && token1 !== ASTR_ADDRESS) {
                Logger.debug(`Ни token0, ни token1 не равен ASTR`);
                continue;
              }

              const amount0Desired = parsed.amount0Desired || 0n;
              const amount1Desired = parsed.amount1Desired || 0n;

              let astrAmountBN: bigint | null = null;
              let ethAmountBN: bigint | null = null;

              if (token0 === ASTR_ADDRESS) {
                astrAmountBN = amount0Desired;
              }
              if (token1 === ASTR_ADDRESS) {
                astrAmountBN = amount1Desired;
              }
              if (token0 === SECOND_ADDRESS) {
                ethAmountBN = amount0Desired;
              }
              if (token1 === SECOND_ADDRESS) {
                ethAmountBN = amount1Desired;
              }

              if (!astrAmountBN) {
                Logger.debug(`Не нашли amount, соответствующий ASTR`);
                continue;
              }

              const astrAmount = ethers.formatUnits(astrAmountBN, 18);
              const ethAmount = ethers.formatUnits(ethAmountBN || 0n, 18);
              Logger.debug(
                `Astr amount: ${astrAmount}, Eth amount: ${ethAmount}`
              );

              const astrUSDValue = await this.getUSDValue(
                'astroport',
                astrAmount
              );
              const ethUSDValue = await this.getUSDValue('ethereum', ethAmount);
              Logger.debug(
                `Astr value: ${astrUSDValue}, Eth value: ${ethUSDValue}`
              );

              const totalValue = astrUSDValue + ethUSDValue;
              Logger.debug(`totalValue ${totalValue}`);

              if (totalValue >= (questTask.minAmountUSD || 20)) {
                await this.questRepository.completeQuest(id, address);
                if (questStored.sequence === 1) {
                  await this.campaignService.incrementParticipants(
                    questStored.campaign_id
                  );
                  Logger.debug(
                    `Campaign ${questStored.campaign_id}: participants incremented for first quest.`
                  );
                }
                return true;
              }
            }

            for (const callData of topParsed.args[0]) {
              const parsed = this.parseMintManual(callData);
              if (!parsed || !parsed.token0 || !parsed.token1) {
                continue;
              }

              const token0 = parsed.token0.toLowerCase();
              const token1 = parsed.token1.toLowerCase();
              const ASTR_ADDRESS = '0x2cae934a1e84f693fbb78ca5ed3b0a6893259441';
              const SECOND_ADDRESS = questTask.abi_equals[0][1];

              if (token0 !== ASTR_ADDRESS && token1 !== ASTR_ADDRESS) {
                Logger.debug(`Ни token0, ни token1 не равен ASTR`);
                continue;
              }

              const amount0Desired = parsed.amount0Desired || 0n;
              const amount1Desired = parsed.amount1Desired || 0n;

              let astrAmountBN: bigint | null = null;
              let ethAmountBN: bigint | null = null;

              if (token0 === ASTR_ADDRESS) {
                astrAmountBN = amount0Desired;
              }
              if (token1 === ASTR_ADDRESS) {
                astrAmountBN = amount1Desired;
              }
              if (token0 === SECOND_ADDRESS) {
                ethAmountBN = amount0Desired;
              }
              if (token1 === SECOND_ADDRESS) {
                ethAmountBN = amount1Desired;
              }

              if (!astrAmountBN) {
                Logger.debug(`Не нашли amount, соответствующий ASTR`);
                continue;
              }

              const astrAmount = ethers.formatUnits(astrAmountBN, 18);
              const ethAmount = ethers.formatUnits(ethAmountBN || 0n, 18);
              Logger.debug(
                `Astr amount: ${astrAmount}, Eth amount: ${ethAmount}`
              );

              const astrUSDValue = await this.getUSDValue(
                'astroport',
                astrAmount
              );
              const ethUSDValue = await this.getUSDValue('ethereum', ethAmount);
              Logger.debug(
                `Astr value: ${astrUSDValue}, Eth value: ${ethUSDValue}`
              );

              const totalValue = astrUSDValue + ethUSDValue;
              Logger.debug(`totalValue ${totalValue}`);

              if (totalValue >= (questTask.minAmountUSD || 20)) {
                await this.questRepository.completeQuest(id, address);
                if (questStored.sequence === 1) {
                  await this.campaignService.incrementParticipants(
                    questStored.campaign_id
                  );
                  Logger.debug(
                    `Campaign ${questStored.campaign_id}: participants incremented for first quest.`
                  );
                }
                return true;
              }
            }
          } catch (error) {
            Logger.error(`Ошибка обработки транзакции: ${error.message}`);
            continue;
          }
        }
        return false;
      }

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
          if (questStored.sequence === 1) {
            await this.campaignService.incrementParticipants(
              questStored.campaign_id
            );
            Logger.debug(
              `Campaign ${questStored.campaign_id}: participants incremented for first quest.`
            );
          }
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

  async extractAstrValueFromMulticall(
    questTask: QuestTask,
    calls: string[]
  ): Promise<string | null> {
    const ASTR_ADDRESS = '0x2cae934a1e84f693fbb78ca5ed3b0a6893259441';
    const abi = this.contractAbiMap[questTask.contract.toLowerCase()];

    const iface = new ethers.Interface(abi);

    for (const callData of calls) {
      if (!callData.startsWith('0x')) {
        continue;
      }
      try {
        const parsedTx = iface.parseTransaction({ data: callData });
        if (!parsedTx) continue;

        Logger.debug(`Parsed: ${parsedTx.name}, args: ${parsedTx.args}`);

        const tokenAddr = (parsedTx.args[0] as string).toLowerCase();
        const amountBN = parsedTx.args[1] as bigint;

        if (tokenAddr === ASTR_ADDRESS) {
          const astrValue = ethers.formatUnits(amountBN, 18);
          return astrValue;
        }
      } catch (err) {
        Logger.debug(`Ошибка парсинга: ${err}`);
        continue;
      }
    }
    return null;
  }

  private buildLinkUrl(
    endpoint: string,
    paramsStr: string,
    address: string
  ): string {
    const replaced = paramsStr.replace(/\$\{address\}/g, `"${address}"`);
    let jsonStr = replaced.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
    jsonStr = jsonStr.replace(/:\s*(0x[0-9a-fA-F]+)/g, ': "$1"');
    let paramsObj: Record<string, any>;
    try {
      paramsObj = JSON.parse(jsonStr);
    } catch (err) {
      throw new Error(
        `Error parsing params JSON: ${err.message}. JSON: ${jsonStr}`
      );
    }
    if (paramsObj.minOutputAmount) {
      paramsObj.minOutputAmount = Number(paramsObj.minOutputAmount) * 1000000;
    }
    const qs = new URLSearchParams(paramsObj).toString();
    return `${endpoint}?${qs}`;
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
      const fallbackAbi = this.contractAbiMap[questTask.contract.toLowerCase()];
      contractInterface = new ethers.Interface(fallbackAbi);
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

      if (!toAddress || !inputData) {
        continue;
      }

      let parsedValue = 0n;
      if (typeof valueHex === 'string' && valueHex.startsWith('0x')) {
        try {
          parsedValue = ethers.toBigInt(valueHex);
        } catch {
          parsedValue = 0n;
        }
      }

      let parsedCall: ethers.TransactionDescription | null = null;
      try {
        parsedCall = contractInterface.parseTransaction({
          data: inputData,
          value: parsedValue,
        });
      } catch (err) {
        Logger.debug(`parseTransaction error: ${err.message}`);
        continue;
      }

      if (!parsedCall) {
        continue;
      }

      Logger.debug(`Inner call method: ${parsedCall.name}`);
      if (parsedCall.name === 'multicall') {
        if (call.calls && Array.isArray(call.calls)) {
          const subCheck = await this.traverseMulticall(call.calls, questTask);
          if (subCheck) return true;
        }
        continue;
      }
      if (!parsedCall) {
        if (call.calls && Array.isArray(call.calls)) {
          const subCheck = await this.traverseMulticall(call.calls, questTask);
          if (subCheck) return false;
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

  private parseMintManual(inputData: string) {
    if (inputData && inputData.startsWith('0x')) {
      inputData = inputData.slice(2);
    } else return;

    const methodId = inputData.slice(0, 8);

    let offset = 8;

    const wordSize = 64;

    function readWord(): string {
      const wordHex = inputData.slice(offset, offset + wordSize);
      offset += wordSize;
      return wordHex;
    }

    const token0Word = readWord(); // 1) token0
    const token1Word = readWord(); // 2) token1
    const feeWord = readWord(); // 3) fee (uint24)
    const tickLWord = readWord(); // 4) tickLower (int24)
    const tickUWord = readWord(); // 5) tickUpper (int24)
    const amt0Word = readWord(); // 6) amount0Desired (uint256)
    const amt1Word = readWord(); // 7) amount1Desired (uint256)
    const amt0MinW = readWord(); // 8) amount0Min
    const amt1MinW = readWord(); // 9) amount1Min
    const recWord = readWord(); // 10) recipient (address)
    const ddlWord = readWord(); // 11) deadline (uint256)

    function parseAddress(wordHex: string): string {
      const last40 = wordHex.slice(24);
      return '0x' + last40.toLowerCase();
    }

    const token0 = parseAddress(token0Word);
    const token1 = parseAddress(token1Word);

    function hexToBigInt(hex: string): bigint {
      if (!hex || hex.length === 0) {
        return 0n;
      }
      return BigInt('0x' + hex);
    }

    const fee256 = hexToBigInt(feeWord); // всё 256
    const fee = Number(fee256 & BigInt(0xffffff)); // 24 бита

    const tickL256 = hexToBigInt(tickLWord);
    const raw24 = Number(tickL256 & BigInt(0xffffff));
    const signBit = 1 << 23;
    let tickLower = raw24;
    if ((raw24 & signBit) !== 0) {
      tickLower = raw24 - (1 << 24);
    }

    const tickU256 = hexToBigInt(tickUWord);
    const raw24U = Number(tickU256 & BigInt(0xffffff));
    let tickUpper = raw24U;
    if ((raw24U & signBit) !== 0) {
      tickUpper = raw24U - (1 << 24);
    }

    const amount0Desired = hexToBigInt(amt0Word);
    const amount1Desired = hexToBigInt(amt1Word);
    const amount0Min = hexToBigInt(amt0MinW);
    const amount1Min = hexToBigInt(amt1MinW);
    const deadline = hexToBigInt(ddlWord);

    const recipient = parseAddress(recWord);

    return {
      methodId,
      token0,
      token1,
      fee,
      tickLower,
      tickUpper,
      amount0Desired,
      amount1Desired,
      amount0Min,
      amount1Min,
      recipient,
      deadline,
    };
  }

  async extractMintAmounts(
    multicallInput: string[]
  ): Promise<{ astrAmount: string } | null> {
    if (!multicallInput || multicallInput.length === 0) {
      Logger.error('extractMintAmounts: пустой массив входных данных');
      return null;
    }
    const mintData = multicallInput[0];
    const parsed = this.parseMintManual(mintData);
    if (!parsed) {
      Logger.error('extractMintAmounts: не удалось распарсить mint данные');
      return null;
    }

    const ASTR_ADDRESS = '0x2cae934a1e84f693fbb78ca5ed3b0a6893259441';

    let astrAmountBN: bigint | null = null;

    if (parsed.token0.toLowerCase() === ASTR_ADDRESS) {
      astrAmountBN = parsed.amount0Desired;
    } else if (parsed.token1.toLowerCase() === ASTR_ADDRESS) {
      astrAmountBN = parsed.amount1Desired;
    }

    if (!astrAmountBN) {
      Logger.error('extractMintAmounts: не найдено значение для ASTR');
      return null;
    }
    if (astrAmountBN) {
      console.log(astrAmountBN, 'parsed---->', parsed);
    }
    const astrAmount = ethers.formatUnits(astrAmountBN, 18);

    Logger.debug(`Извлечены суммы: ASTR = ${astrAmount}`);
    return { astrAmount };
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
    if (parsedTx.name === 'deposit') {
      const amountBN: bigint = parsedTx.args[0];
      const astrAmount = ethers.formatUnits(amountBN, 6);
      const minBN = questTask.minAmountUSD || '1000000';

      if (+astrAmount < +minBN) {
        Logger.debug(`Deposit: ${amountBN} < required ${minBN}`);
        return false;
      }

      return true;
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
      if (token1 === ASTR_ADDRESS) {
        astrAmountBN = amount1Desired;
      }
      if (token0 === SECOND_ADDRESS) {
        ethAmountBN = amount0Desired;
      }
      if (token1 === SECOND_ADDRESS) {
        ethAmountBN = amount1Desired;
      }

      if (!astrAmountBN) {
        Logger.debug(`Не нашли amount, соответствующий ASTR`);
        return false;
      }

      const astrAmount = ethers.formatUnits(astrAmountBN || 0, 18);
      const ethAmount = ethers.formatUnits(ethAmountBN || 0, 18);

      Logger.debug(`Astr amount: ${astrAmount}, Eth amount: ${ethAmount}`);

      const astrUSDValue = await this.getUSDValue('astroport', astrAmount);
      const ethUSDValue = await this.getUSDValue('ethereum', ethAmount);
      Logger.debug(`Astr value: ${astrUSDValue}, Eth value: ${ethUSDValue}`);

      const totalValue = astrUSDValue + ethUSDValue;

      if (totalValue < (questTask.minAmountUSD || 20)) {
        Logger.debug(
          `Сумма ASTR в ликвидности (${totalValue} USD) меньше, чем нужно (${questTask.minAmountUSD} USD)`
        );
        return false;
      }
      return true;
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

    const realArgs = Array.from(parsedTx.args || []);

    for (const conditionArr of questTask.abi_equals) {
      let isConditionMatched = true;
      for (let i = 0; i < conditionArr.length; i++) {
        const expected = conditionArr[i];
        if (expected === 0 || expected === undefined) {
          continue;
        }

        if (typeof expected === 'string') {
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
