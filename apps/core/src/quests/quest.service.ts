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
    vastr: 'bifrost-voucher-astr',
    yayeth: 'yay-stakestone-ether',
  };

  constructor(
    private readonly questRepository: QuestRepository,
    private readonly userService: UserService,
    private readonly campaignService: CampaignService,
    private readonly priceService: PriceService
  ) {}

  async getAllCompletedQuestsByUser(address: string) {
    return await this.questRepository.getAllCompletedQuestsByUser(address);
  }

  async getCampaignById(id: string) {
    return await this.campaignService.getCampaignByIdOrSlug(id);
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
            const rewards = campaign.rewards;

            let totalPoints = 0;
            rewards.forEach((reward: any) => {
              if (reward.type === 'tokens') {
                totalPoints += parseInt(reward.value, 10);
              }
            });

            const nftConfigs = [
              {
                address:
                  '0x39dF84267Fda113298d4794948B86026EFD47e32'.toLowerCase(),
                multiplier: 1.1,
              },
              {
                address:
                  '0x181b42ca4856237AE76eE8c67F8FF112491eCB9e'.toLowerCase(),
                multiplier: 1.2,
              },
            ];

            let userMultiplier = 1;
            for (const nft of nftConfigs) {
              const contract = new ethers.Contract(
                nft.address,
                ['function balanceOf(address owner) view returns (uint256)'],
                soneiumProvider
              );
              const balance = await contract.balanceOf(lowerAddress);
              if (balance && +balance.toString() > 0) {
                userMultiplier = Math.max(userMultiplier, nft.multiplier);
              }
            }

            const effectivePoints = totalPoints * userMultiplier;
            await this.userService.awardCampaignCompletion(
              lowerAddress,
              effectivePoints
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

          const nftConfigs = [
            {
              address:
                '0x39dF84267Fda113298d4794948B86026EFD47e32'.toLowerCase(),
              multiplier: 1.1,
            },
            {
              address:
                '0x181b42ca4856237AE76eE8c67F8FF112491eCB9e'.toLowerCase(),
              multiplier: 1.2,
            },
          ];

          let userMultiplier = 1;
          for (const nft of nftConfigs) {
            const contract = new ethers.Contract(
              nft.address,
              ['function balanceOf(address owner) view returns (uint256)'],
              soneiumProvider
            );
            const balance = await contract.balanceOf(lowerAddress);
            if (balance && +balance.toString() > 0) {
              userMultiplier = Math.max(userMultiplier, nft.multiplier);
            }
          }

          const effectivePoints = totalPoints * userMultiplier;
          await this.userService.awardCampaignCompletion(
            lowerAddress,
            effectivePoints
          );
        }
      }
    } catch (error) {
      throw new InternalServerErrorException(
        `Ошибка при завершении квеста и начислении баллов: ${error.message}`
      );
    }
  }
  private createBlockscoutUrl(
    chain: string,
    address: string,
    campaign: any
  ): string {
    let baseUrl = 'https://soneium.blockscout.com';
    if (chain === 'Soneium') {
      baseUrl = 'https://soneium.blockscout.com';
    } else if (chain === 'Ethereum') {
      return 'https://soneium.blockscout.com/api?module=account&action=eth_get_balance&address=';
    } else {
      throw new Error(`Unsupported chain: ${chain}`);
    }

    const nowUnix = Math.floor(Date.now() / 1000);
    const weekAgoUnix = nowUnix - 30 * 48 * 60 * 60;
    const startedAt = Math.floor(campaign.started_at / 1000);
    let queryParams;
    if (campaign.ignore_campaign_start) {
      queryParams = new URLSearchParams({
        module: 'account',
        action: 'txlist',
        address: address,
        start_timestamp: weekAgoUnix.toString(),
        end_timestamp: nowUnix.toString() + 1000,
        page: '0',
        offset: '500',
        sort: 'desc',
      });
    } else {
      queryParams = new URLSearchParams({
        module: 'account',
        action: 'txlist',
        address: address,
        start_timestamp: startedAt.toString(),
        end_timestamp: nowUnix.toString() + 1000,
        page: '0',
        offset: '500',
        sort: 'desc',
      });
    }

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
          console.log('------>', finalUrl);
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
        const contractAddress = questTask.contract;
        if (
          contractAddress.toLowerCase() ===
          '0xEB255E4669Da7FeEf1F746a5a778b4e08b65a1A7'.toLowerCase()
        ) {
          const contractABI = [
            'function balanceOf(address account, uint256 id) view returns (uint256)',
          ];
          const contract = new ethers.Contract(
            contractAddress,
            contractABI,
            soneiumProvider
          );

          const newBalance = await contract.balanceOf(address, 0);

          if (+newBalance.toString() > 0) {
            await this.questRepository.completeQuest(id, address);
            if (questStored.sequence === 1) {
              await this.campaignService.incrementParticipants(
                questStored.campaign_id
              );
            }
            return true;
          }
          return false;
        }
        const contractABI = [
          'function balanceOf(address owner) view returns (uint256)',
        ];

        const contract = new ethers.Contract(
          contractAddress,
          contractABI,
          soneiumProvider
        );

        const balance = await contract.balanceOf(address);

        if (+balance.toString() > 0) {
          await this.questRepository.completeQuest(id, address);
          if (questStored.sequence === 1) {
            await this.campaignService.incrementParticipants(
              questStored.campaign_id
            );
          }
          return true;
        }
        return false;
      }
      const campaign = await this.campaignService.getCampaignByIdOrSlug(
        questStored.campaign_id
      );

      const url = this.createBlockscoutUrl(questTask.chain, address, campaign);
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
        el.includes('function supply(')
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

      const ifCaseExecute = questTask.abi_to_find.filter((abiStr) =>
        abiStr.includes('function execute(bytes commands, bytes[] inputs)')
      );

      if (ifCaseExecute.length > 0) {
        for (const tx of userTransactions) {
          try {
            if (
              !tx.to ||
              tx.to.toLowerCase() !== questTask.contract.toLowerCase()
            )
              continue;

            for (const abiStr of ifCaseExecute) {
              const iface = new ethers.Interface([abiStr]);
              let parsed;
              try {
                parsed = iface.parseTransaction({ data: tx.input });
              } catch (err) {
                continue;
              }
              if (!parsed) continue;

              if (parsed.name === 'execute') {
                const inputs = parsed.args[1];
                if (inputs.length > 2) {
                  return false;
                }
                for (const encodedInput of inputs) {
                  try {
                    const data = encodedInput.replace(/^0x/, '').toLowerCase();

                    const chunkSize = 64;
                    const chunks = data.match(
                      new RegExp(`.{1,${chunkSize}}`, 'g')
                    );

                    if (!chunks || chunks.length < 2) {
                      return null;
                    }

                    const valueHex = '0x' + chunks[1];

                    const valueWei = BigInt(valueHex);

                    const depositAmount = ethers.formatUnits(valueWei, 18);
                    Logger.debug(`Deposit amount (raw): ${depositAmount}`);

                    const depositUSDValue = await this.getUSDValue(
                      'ethereum',
                      depositAmount
                    );
                    const token0 =
                      '4200000000000000000000000000000000000006'.toLowerCase();
                    const token1 =
                      '2CAE934a1e84F693fbb78CA5ED3B0A6893259441'.toLowerCase();
                    const minLimit = questTask.minAmountUSD;
                    const dataLC = encodedInput.toLowerCase();
                    const isPairValid =
                      encodedInput.toLowerCase().includes(token0) &&
                      encodedInput.toLowerCase().includes(token1);
                    const isAmountValid = depositUSDValue >= minLimit;
                    if (isPairValid && isAmountValid) {
                      await this.questRepository.completeQuest(id, address);
                      if (questStored.sequence === 1) {
                        await this.campaignService.incrementParticipants(
                          questStored.campaign_id
                        );
                      }
                      return true;
                    } else {
                      console.log('❌ Квест не выполнен.');
                    }
                  } catch (error) {
                    continue;
                  }
                }
              }
            }
          } catch (error) {
            Logger.error(
              `Ошибка обработки транзакции (execute): ${error.message}`
            );
            continue;
          }
        }
        return false;
      }

      const ifCaseStake = questTask.abi_to_find.filter((abiStr) =>
        abiStr.includes('function stake')
      );

      if (ifCaseStake.length > 0) {
        for (const tx of userTransactions) {
          try {
            if (
              !tx.to ||
              tx.to.toLowerCase() !== questTask.contract.toLowerCase()
            )
              continue;

            for (const abiStr of ifCaseStake) {
              const iface = new ethers.Interface([abiStr]);
              let parsed;
              try {
                parsed = iface.parseTransaction({ data: tx.input });
              } catch (err) {
                continue;
              }
              if (!parsed) continue;

              if (parsed.name === 'stake') {
                if (questTask.minAmountUSD) {
                  const stakeAmountBN = parsed.args[0] as bigint;
                  const stakeAmountDecimal = ethers.formatUnits(
                    stakeAmountBN,
                    18
                  );
                  const usdValue = await this.getUSDValue(
                    'astroport',
                    stakeAmountDecimal
                  );
                  if (+usdValue >= +questTask.minAmountUSD) {
                    await this.questRepository.completeQuest(id, address);
                    if (questStored.sequence === 1) {
                      await this.campaignService.incrementParticipants(
                        questStored.campaign_id
                      );
                    }
                    return true;
                  }
                } else {
                  await this.questRepository.completeQuest(id, address);
                  if (questStored.sequence === 1) {
                    await this.campaignService.incrementParticipants(
                      questStored.campaign_id
                    );
                  }
                  return true;
                }
              }
            }
          } catch (error) {
            Logger.error(
              `Ошибка обработки транзакции (execute): ${error.message}`
            );
            continue;
          }
        }
        return false;
      }

      const ifCaseEvent = questTask.abi_to_find.filter((abiStr) =>
        abiStr.includes('event StakeInited')
      );

      if (ifCaseEvent.length > 0) {
        for (const tx of userTransactions) {
          try {
            if (
              !tx.to ||
              tx.to.toLowerCase() !== questTask.contract.toLowerCase()
            )
              continue;
            console.log('------>', tx);
            for (const abiStr of ifCaseEvent) {
              const iface = new ethers.Interface([abiStr]);
              let parsed;
              try {
                parsed = iface.parseTransaction({ data: tx.input });
              } catch (err) {
                continue;
              }
              if (!parsed) continue;
              console.log('------>', parsed);
              if (parsed.name === 'stake') {
                await this.questRepository.completeQuest(id, address);
                if (questStored.sequence === 1) {
                  await this.campaignService.incrementParticipants(
                    questStored.campaign_id
                  );
                }
                return true;
              }
            }
          } catch (error) {
            Logger.error(
              `Ошибка обработки транзакции (execute): ${error.message}`
            );
            continue;
          }
        }
        return false;
      }

      const ifCaseDepositX = questTask.abi_to_find.find((sig) => {
        if (sig.includes('function deposit(')) {
          return questTask.abi_to_find;
        }
      });

      if (ifCaseDepositX) {
        for (const tx of userTransactions) {
          try {
            const iface = new ethers.Interface(questTask.abi_to_find);

            let parsed;
            try {
              parsed = iface.parseTransaction({ data: tx.input });
            } catch (err) {
              continue;
            }

            if (!parsed) continue;

            const tokenAmountBN = parsed.args[0] as bigint;
            const tokenAmount = tokenAmountBN.toString();
            let depositAmountDecimal;
            let usdValue;
            if (
              questTask.contract.toLowerCase() ===
              '0x34834F208F149e0269394324c3f19e06dF2ca9cB'.toLowerCase()
            ) {
              depositAmountDecimal = ethers.formatUnits(tokenAmount, 6);
              console.log(
                '------>',
                +depositAmountDecimal >= questTask.minAmountUSD
              );
              if (+depositAmountDecimal >= questTask.minAmountUSD) {
                await this.questRepository.completeQuest(id, address);
                if (questStored.sequence === 1) {
                  await this.campaignService.incrementParticipants(
                    questStored.campaign_id
                  );
                }
                return true;
              }
            } else {
              depositAmountDecimal = ethers.formatUnits(tokenAmount, 18);
              usdValue = await this.getUSDValue('yayeth', depositAmountDecimal);
              const totalValue = usdValue * 2;
              if (totalValue >= questTask.minAmountUSD) {
                await this.questRepository.completeQuest(id, address);
                if (questStored.sequence === 1) {
                  await this.campaignService.incrementParticipants(
                    questStored.campaign_id
                  );
                }
                return true;
              }
            }
            return false;
          } catch (error) {
            Logger.error(`Ошибка обработки транзакции: ${error.message}`);
            continue;
          }
        }
        return false;
      }

      const ifCaseCheck = questTask.abi_to_find.filter((abiStr) =>
        abiStr.includes('function checkIn')
      );

      if (ifCaseCheck.length > 0) {
        for (const tx of userTransactions) {
          try {
            if (
              !tx.to ||
              tx.to.toLowerCase() !== questTask.contract.toLowerCase()
            )
              continue;

            for (const abiStr of ifCaseCheck) {
              const iface = new ethers.Interface([abiStr]);
              let parsed;
              try {
                parsed = iface.parseTransaction({ data: tx.input });
              } catch (err) {
                continue;
              }
              if (!parsed) continue;

              if (parsed.name === 'checkIn') {
                await this.questRepository.completeQuest(id, address);
                if (questStored.sequence === 1) {
                  await this.campaignService.incrementParticipants(
                    questStored.campaign_id
                  );
                }
                return true;
              }
            }
          } catch (error) {
            Logger.error(
              `Ошибка обработки транзакции (execute): ${error.message}`
            );
            continue;
          }
        }
        return false;
      }

      const ifCaseBorrowNew = questTask.abi_to_find.some((abiStr) =>
        abiStr.includes('function supplyCollateralAndBorrow')
      );

      if (ifCaseBorrowNew) {
        for (const tx of userTransactions) {
          try {
            for (const abiStr of questTask.abi_to_find) {
              const iface = new ethers.Interface([abiStr]);
              let parsed;
              try {
                parsed = iface.parseTransaction({ data: tx.input });
              } catch {
                continue;
              }
              if (!parsed) continue;
              if (parsed.name === 'supplyCollateralAndBorrow') {
                const borrowAmountBN = parsed.args[2] as bigint;
                const tokenAddr = (parsed.args[3] as string).toLowerCase();
                if (
                  tokenAddr ===
                  '0xbA9986D2381edf1DA03B0B9c1f8b00dc4AacC369'.toLowerCase()
                ) {
                  const borrowAmountDecimal = ethers.formatUnits(
                    borrowAmountBN,
                    18
                  );
                  const usdValue = await this.getUSDValue(
                    'astroport',
                    borrowAmountDecimal
                  );
                  if (usdValue >= (questTask.minAmountUSD || 10)) {
                    await this.questRepository.completeQuest(id, address);
                    if (questStored.sequence === 1) {
                      await this.campaignService.incrementParticipants(
                        questStored.campaign_id
                      );
                    }
                    return true;
                  }
                }
              } else if (parsed.name === 'borrow') {
                const borrowAmountBN = parsed.args[1] as bigint;
                const borrowAmountDecimal = ethers.formatUnits(
                  borrowAmountBN,
                  18
                );
                const usdValue = await this.getUSDValue(
                  'astroport',
                  borrowAmountDecimal
                );
                if (usdValue >= (questTask.minAmountUSD || 10)) {
                  await this.questRepository.completeQuest(id, address);
                  if (questStored.sequence === 1) {
                    await this.campaignService.incrementParticipants(
                      questStored.campaign_id
                    );
                  }
                  return true;
                }
              }
            }
          } catch (error) {
            Logger.debug(`Borrow parse error: ${error.message}`);
            continue;
          }
        }
        return false;
      }

      const ifCaseBuyNew = questTask.abi_to_find.filter((el) =>
        el.includes('function buy(uint256 weth2Eth')
      );

      if (ifCaseBuyNew.length > 0) {
        for (const tx of userTransactions) {
          try {
            for (const abiStr of ifCaseBuyNew) {
              const iface = new ethers.Interface([abiStr]);
              let parsed;
              try {
                parsed = iface.parseTransaction({ data: tx.input });
              } catch (e) {
                continue;
              }
              if (!parsed) continue;

              if (parsed.name === 'buy') {
                await this.questRepository.completeQuest(id, address);
                if (questStored.sequence === 1) {
                  await this.campaignService.incrementParticipants(
                    questStored.campaign_id
                  );
                }
                return true;
              }
            }
          } catch (error) {
            Logger.error(`Ошибка обработки транзакции (buy): ${error.message}`);
            continue;
          }
        }
        return false;
      }

      const ifCaseAddLiquidityETH = questTask.abi_to_find.filter((abiStr) =>
        abiStr.includes('function addLiquidityETH(')
      );

      if (ifCaseAddLiquidityETH.length > 0) {
        for (const tx of userTransactions) {
          try {
            for (const abiStr of ifCaseAddLiquidityETH) {
              const iface = new ethers.Interface([abiStr]);

              let parsedTx: ethers.TransactionDescription | null = null;
              try {
                parsedTx = iface.parseTransaction({
                  data: tx.input,
                });
              } catch {
                continue;
              }

              if (!parsedTx) continue;

              if (parsedTx.name === 'addLiquidityETH') {
                /**
                 *  0: token (address)
                 *  1: amountTokenDesired (uint256)
                 *  2: amountTokenMin (uint256)
                 *  3: amountETHMin (uint256)
                 *  4: to (address)
                 *  5: deadline (uint256)
                 */
                const tokenAddr = (parsedTx.args[0] as string).toLowerCase();

                const astrAddress =
                  '0x2cae934a1e84f693fbb78ca5ed3b0a6893259441';
                if (tokenAddr !== astrAddress.toLowerCase()) {
                  continue;
                }

                const amountTokenDesiredBN = parsedTx.args[1] as bigint;

                const amountEthBN = tx.value ?? 0n;

                const astrDesired = ethers.formatUnits(
                  amountTokenDesiredBN,
                  18
                );
                const ethDesired = ethers.formatUnits(amountEthBN, 18);

                const astrUSDValue = await this.getUSDValue(
                  'astroport',
                  astrDesired
                );
                const ethUSDValue = await this.getUSDValue(
                  'ethereum',
                  ethDesired
                );
                const totalValue = astrUSDValue + ethUSDValue;
                console.log('------>', astrUSDValue, ethUSDValue, totalValue);

                if (totalValue >= (questTask.minAmountUSD || 20)) {
                  await this.questRepository.completeQuest(id, address);

                  if (questStored.sequence === 1) {
                    await this.campaignService.incrementParticipants(
                      questStored.campaign_id
                    );
                  }
                  return true;
                }
              }
            }
          } catch (error) {
            Logger.debug(`Parse error (addLiquidityETH): ${error.message}`);
            continue;
          }
        }

        return false;
      }

      const swapSig = questTask.abi_to_find.find((sig) =>
        sig.includes('function swap(')
      );

      if (swapSig) {
        for (const tx of userTransactions) {
          try {
            const iface = new ethers.Interface(questTask.abi_to_find);

            let parsed: ethers.TransactionDescription | null = null;
            try {
              parsed = iface.parseTransaction({ data: tx.input });
            } catch (err) {
              continue;
            }

            if (!parsed) continue;
            let totalUsdValue = 0;
            if (parsed.name === 'swap') {
              // {
              //    0: address,
              //    1: bigint (uint256),
              //    2: string[],
              //    3: array of [...],
              //    4: array of bigint,
              //    5: array of bigint,
              // }
              //

              const request = parsed.args[0];
              const routes = request[3];

              for (const route of routes) {
                const tokenAddr = route[0] as string;
                const amountBN = route[1] as bigint;
                const tokenAddr2 = route[2][0][0] as string;
                const amountBN2 = request[request.length - 1][0] as bigint;
                const amountDecimal = ethers.formatUnits(amountBN, 8);
                const amountDecimal2 = ethers.formatUnits(amountBN2, 18);

                console.log('------>', amountBN, amountBN2);

                let tokenKey = 'ethereum';
                let tokenKey2 = 'ethereum';
                if (
                  tokenAddr.toLowerCase() ===
                  '0x2cae934a1e84f693fbb78ca5ed3b0a6893259441'.toLowerCase()
                ) {
                  tokenKey = 'astroport';
                } else if (
                  tokenAddr.toLowerCase() ===
                  '0x60336f9296C79dA4294A19153eC87F8E52158e5F'.toLowerCase()
                ) {
                  tokenKey = 'vastr';
                }

                const usdValueForRoute = await this.getUSDValue(
                  tokenKey,
                  amountDecimal
                );
                console.log('tokenKey------>', tokenKey, amountDecimal);
                console.log('usdValueForRoute------>', usdValueForRoute);

                if (
                  tokenAddr2.toLowerCase() ===
                  '0x2cae934a1e84f693fbb78ca5ed3b0a6893259441'.toLowerCase()
                ) {
                  tokenKey2 = 'astroport';
                } else if (
                  tokenAddr2.toLowerCase() ===
                  '0x60336f9296C79dA4294A19153eC87F8E52158e5F'.toLowerCase()
                ) {
                  tokenKey2 = 'vastr';
                }

                const usdValueForRoute2 = await this.getUSDValue(
                  tokenKey2,
                  amountDecimal2
                );
                console.log('usdValueForRoute2------>', usdValueForRoute2);
                totalUsdValue = usdValueForRoute + usdValueForRoute2;
              }

              Logger.debug(`Total swap USD value: ${totalUsdValue}`);

              if (totalUsdValue >= (questTask.minAmountUSD || 20)) {
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
            Logger.error(`Swap parse error: ${error.message}`);
            continue;
          }
        }
        return false;
      }

      const depositDelegateSig = questTask.abi_to_find.find((sig) => {
        if (
          sig.includes('swapUnderlyingToLst') ||
          sig.includes('depositTokenDelegate')
        ) {
          return questTask.abi_to_find;
        }
      });

      if (depositDelegateSig) {
        for (const tx of userTransactions) {
          try {
            const iface = new ethers.Interface(questTask.abi_to_find);

            let parsed;
            try {
              parsed = iface.parseTransaction({ data: tx.input });
            } catch (err) {
              continue;
            }

            if (!parsed) continue;

            if (
              parsed.name === 'depositTokenDelegate' ||
              parsed.name === 'swapUnderlyingToLst'
            ) {
              const tokenAmountBN = parsed.args[0] as bigint;

              const tokenAmount = tokenAmountBN.toString();
              const depositAmountDecimal = ethers.formatUnits(tokenAmount, 18);
              const usdValue = await this.getUSDValue(
                'astroport',
                depositAmountDecimal
              );
              if (usdValue >= questTask.minAmountUSD) {
                await this.questRepository.completeQuest(id, address);
                if (questStored.sequence === 1) {
                  await this.campaignService.incrementParticipants(
                    questStored.campaign_id
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
        el.includes('function buy((bytes path,address')
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

      const hasMintFunction = questTask.abi_to_find.some((abi) =>
        abi.includes('function mint')
      );

      if (hasMintFunction) {
        for (const tx of userTransactions) {
          try {
            const multicallABI = ['function multicall(bytes[] data)'];
            const mcInterface = new ethers.Interface(multicallABI);

            let topParsed: ethers.TransactionDescription | null = null;

            if (tx.method || tx.input.startsWith('0xac9650d8')) {
              topParsed = this.safeParseTransaction(mcInterface, tx.input);
              if (!topParsed) continue;

              const parsedMint = this.parseMintManual(topParsed.args[0][0]);
              if (
                await this.processParsedMint(
                  parsedMint,
                  questTask,
                  id,
                  address,
                  questStored
                )
              ) {
                return true;
              }
            }

            const delegateABI = [
              'function externalDelegateCall(address target, bytes data)',
            ];
            const dgInterface = new ethers.Interface(delegateABI);

            if (tx.input.startsWith('0x471f85ab')) {
              const tokens = await this.parseExternalDelegateCall(tx.input);
              const astrAmount = ethers.formatUnits(tokens.amount, 14);
              if (+astrAmount > questTask.minAmountUSD) {
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
            } else {
              const manualParsed = this.parseMintManual(tx.input);
              if (
                manualParsed &&
                tx.to.toLowerCase() ===
                  '0xFcD4bE2aDb8cdB01e5308Cd96ba06F5b92aebBa1'.toLowerCase()
              ) {
                const mintABI = [
                  'function mint((uint256,uint256,uint256,address,uint256) mintParams)',
                ];
                const iface = new ethers.Interface(mintABI);
                const parsedTx = iface.parseTransaction({ data: tx.input });

                if (parsedTx.name !== 'mint') {
                  return false;
                }

                const mintParams = parsedTx.args[0];
                const amount = mintParams[1] as bigint;
                const astrAmount = ethers.formatUnits(amount, 18);
                const astrUSDValue = await this.getUSDValue(
                  'astroport',
                  astrAmount
                );
                if (astrUSDValue > questTask.minAmountUSD) {
                  await this.questRepository.completeQuest(
                    questStored.id,
                    address
                  );

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
              if (
                await this.processParsedMint(
                  manualParsed,
                  questTask,
                  id,
                  address,
                  questStored
                )
              ) {
                return true;
              }
            }

            if (topParsed?.args && Array.isArray(topParsed.args[0])) {
              for (const callData of topParsed.args[0]) {
                const nestedParsed = this.parseMintManual(callData);
                if (
                  await this.processParsedMint(
                    nestedParsed,
                    questTask,
                    id,
                    address,
                    questStored
                  )
                ) {
                  return true;
                }
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
  async parseExternalDelegateCall(rawInput: string): Promise<any> {
    const delegateABI = [
      'function externalDelegateCall(address target, bytes data)',
    ];

    const iface = new ethers.Interface(delegateABI);

    let parsedTx;
    try {
      parsedTx = iface.parseTransaction({ data: rawInput });
    } catch (err) {
      console.log('Ошибка parseTransaction:', err);
      return;
    }

    const target = parsedTx.args[0];
    const callData = parsedTx.args[1] as string;

    console.log('Delegate target =>', target);
    console.log('CallData (hex) =>', callData);

    const result = this.parseTokensAndAmount(callData);
    if (result) {
      const { tokenA, tokenB, amount } = result;
      console.log(
        'Найдена пара:',
        tokenA,
        tokenB,
        ' amount =>',
        amount.toString()
      );
    }
    return result;
  }

  parseTokensAndAmount(hexData: string) {
    const data = hexData.startsWith('0x') ? hexData.slice(2) : hexData;

    const tokenAHex = '2cae934a1e84f693fbb78ca5ed3b0a6893259441';
    const tokenBHex = '4200000000000000000000000000000000000006';

    const idxA = data.indexOf(tokenAHex.toLowerCase());
    const idxB = data.indexOf(tokenBHex.toLowerCase());

    if (idxA === -1 || idxB === -1) {
      console.log('Пара 2CAE934... / 420000... не найдена в data');
      return null;
    }

    const next32 = data.slice(
      idxB + tokenBHex.length + 215,
      idxB + tokenBHex.length + 226
    );
    if (!next32) {
      console.log('Не нашли следующего параметра для amount');
      return null;
    }
    console.log('next32------>', next32);
    const amount = BigInt('0x' + next32);

    return {
      tokenA: '0x' + tokenAHex,
      tokenB: '0x' + tokenBHex,
      amount,
    };
  }

  safeParseTransaction(
    iface: ethers.Interface,
    inputData: string
  ): ethers.TransactionDescription | null {
    try {
      return iface.parseTransaction({ data: inputData });
    } catch (err) {
      Logger.debug(`Ошибка парсинга: ${(err as Error).message}`);
      return null;
    }
  }

  private async processParsedMint(
    parsed: any,
    questTask: QuestTask,
    questId: string,
    userAddress: string,
    questStored: QuestType
  ): Promise<boolean> {
    if (!parsed || !parsed.token0 || !parsed.token1) return false;

    const token0 = parsed.token0.toLowerCase();
    const token1 = parsed.token1.toLowerCase();
    const ASTR_ADDRESS = '0x2cae934a1e84f693fbb78ca5ed3b0a6893259441';
    const secondAddress = questTask.abi_equals[0][1].toLowerCase();

    if (token0 !== ASTR_ADDRESS && token1 !== ASTR_ADDRESS) {
      Logger.debug('Ни token0, ни token1 не равен ASTR');
      return false;
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
    if (token0 === secondAddress) {
      ethAmountBN = amount0Desired;
    }
    if (token1 === secondAddress) {
      ethAmountBN = amount1Desired;
    }

    if (!astrAmountBN) {
      Logger.debug(`Не нашли amount, соответствующий ASTR`);
      return false;
    }

    // Форматируем числа
    const astrAmount = ethers.formatUnits(astrAmountBN, 18);
    const ethAmount = ethers.formatUnits(ethAmountBN || 0n, 18);

    Logger.debug(`Astr amount: ${astrAmount}, Eth amount: ${ethAmount}`);

    // Подсчитываем USD стоимость
    const astrUSDValue = await this.getUSDValue('astroport', astrAmount);

    let ethUSDValue;
    if (
      token0 === '0x60336f9296c79da4294a19153ec87f8e52158e5f' ||
      token1 === '0x60336f9296c79da4294a19153ec87f8e52158e5f'
    ) {
      // Если в паре есть vastr
      ethUSDValue = await this.getUSDValue('vastr', ethAmount);
    } else {
      ethUSDValue = await this.getUSDValue('ethereum', ethAmount);
    }

    Logger.debug(`Astr value: ${astrUSDValue}, Eth value: ${ethUSDValue}`);

    const totalValue = astrUSDValue + ethUSDValue;
    Logger.debug(`totalValue ${totalValue}`);

    // Проверяем минимальную сумму
    if (totalValue >= (questTask.minAmountUSD || 20)) {
      await this.questRepository.completeQuest(questId, userAddress);

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

  private async parseSwapFromInputs(
    inputsArray: string[],
    questTask: QuestTask
  ): Promise<boolean> {
    const pairArr = questTask.abi_equals[0];
    // ["0x2cae934a1e84f693fbb78ca5ed3b0a6893259441","0x4200000000000000000000000000000000000006"]
    const minUsd = questTask.minAmountUSD || 1;

    for (const dataHex of inputsArray) {
      // Decode, find the tokens, amounts
      // (Условно) допустим, мы распарсили tokenA, tokenB, amountIn
      const tokenA = '0x2cae934a1e84f693fbb78ca5ed3b0a6893259441';
      const tokenB = '0x4200000000000000000000000000000000000006';
      console.log('------>', dataHex);

      const sumInUsd = 5; // как пример

      if (
        (tokenA.toLowerCase() === pairArr[0].toLowerCase() &&
          tokenB.toLowerCase() === pairArr[1].toLowerCase()) ||
        (tokenA.toLowerCase() === pairArr[1].toLowerCase() &&
          tokenB.toLowerCase() === pairArr[0].toLowerCase())
      ) {
        if (sumInUsd >= minUsd) {
          return false;
        }
      }
    }
    return false;
  }
}
