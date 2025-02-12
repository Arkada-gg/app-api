import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ethers } from 'ethers';
import fetch from 'node-fetch';
import { QuestRepository } from './quest.repository';
import { UserService } from '../user/user.service';
import { CampaignService } from '../campaigns/campaign.service';
import { PriceService } from '../price/price.service';
import { QuestType, QuestTask } from './interface';
import { soneiumProvider, ethProvider } from '../shared/provider';
import { SwapRouterABI } from '../shared/abi/swapRouter';
import { buyABI } from '../shared/abi/newXd';
import { VaultABI } from '../shared/abi/vault-buy-execution';
import { MintNewABI } from '../shared/abi/mintNew';
import { randomABI } from '../shared/abi/idk';
import { UniswapV3PoolABI } from '../shared/abi/uniswapV3Pool';
import { newAbi } from '../shared/abi/newAbi';
import { mintABI } from '../shared/abi/mintABI';
import { l2BridgeABI } from '../shared/abi/l2BridgeABI';
import { ArkadaAbi } from '../shared/abi/arkada';
import { UniswapV3ABI } from '../shared/abi/uniswapV3';

@Injectable()
export class QuestService {
  private readonly contractAbiMap: { [addr: string]: any } = {
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
    '0x4200000000000000000000000000000000000006': 'ethereum',
    '0x2cae934a1e84f693fbb78ca5ed3b0a6893259441': 'astar',
    '0xbA9986D2381edf1DA03B0B9c1f8b00dc4AacC369': 'usdc',
  };

  constructor(
    private readonly questRepository: QuestRepository,
    private readonly userService: UserService,
    private readonly campaignService: CampaignService,
    private readonly priceService: PriceService
  ) {}

  async getAllCompletedQuestsByUser(address: string) {
    return this.questRepository.getAllCompletedQuestsByUser(address);
  }

  async getCompletedQuestsByUserInCampaign(
    campaignId: string,
    address: string
  ) {
    return this.questRepository.getCompletedQuestsByUserInCampaign(
      campaignId,
      address
    );
  }

  async checkQuestCompletion(id: string, address: string) {
    return this.questRepository.checkQuestCompletion(id, address);
  }

  async getQuestValue(id: string): Promise<any> {
    const quest = await this.questRepository.getQuest(id);
    return quest.value;
  }

  async getQuest(id: string): Promise<QuestType> {
    const quest = await this.questRepository.getQuest(id);
    return quest;
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

  async completeQuestAndAwardPoints(questId: string, userAddress: string) {
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
          const rewards = campaign.rewards;
          let totalPoints = 0;
          rewards.forEach((r: any) => {
            if (r.type === 'tokens') totalPoints += parseInt(r.value, 10);
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
  }

  async completeQuestQuiz(id: string, userAddress: string): Promise<boolean> {
    try {
      const alreadyDone = await this.questRepository.checkQuestCompletion(
        id,
        userAddress
      );
      if (alreadyDone) return true;
      const questStored = await this.questRepository.getQuest(id);
      const allInCampaign = await this.questRepository.getQuestsByCampaign(
        questStored.campaign_id
      );
      const idx = allInCampaign.findIndex((q) => q.id === questStored.id);
      if (idx === -1) {
        throw new NotFoundException(
          `Quest with id ${id} not found in campaign`
        );
      }
      for (let i = 0; i < idx; i++) {
        const prior = allInCampaign[i];
        const done = await this.questRepository.checkQuestCompletion(
          prior.id,
          userAddress
        );
        if (!done) {
          throw new BadRequestException(
            `Для выполнения этого квеста нужно сначала пройти: ${prior.name}`
          );
        }
      }
      await this.questRepository.completeQuest(id, userAddress.toLowerCase());
      if (questStored.sequence === 1) {
        await this.campaignService.incrementParticipants(
          questStored.campaign_id
        );
      }
      try {
        const doneList =
          await this.questRepository.getCompletedQuestsByUserInCampaign(
            questStored.campaign_id,
            userAddress.toLowerCase()
          );
        if (doneList.length === allInCampaign.length) {
          const wasMarked = await this.campaignService.markCampaignAsCompleted(
            questStored.campaign_id,
            userAddress.toLowerCase()
          );
          if (wasMarked) {
            const camp = await this.campaignService.getCampaignByIdOrSlug(
              questStored.campaign_id
            );
            const rewards = camp.rewards || [];
            let totalPoints = 0;
            rewards.forEach((rw: any) => {
              if (rw.type === 'tokens') {
                totalPoints += parseInt(rw.value, 10);
              }
            });
            await this.userService.awardCampaignCompletion(
              userAddress.toLowerCase(),
              totalPoints
            );
          }
        }
      } catch (err) {
        throw new InternalServerErrorException(
          `Ошибка при завершении квеста и начислении баллов: ${err.message}`
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

  async checkQuest(id: string, address: string): Promise<boolean> {
    const doneAlready = await this.questRepository.checkQuestCompletion(
      id,
      address
    );
    if (doneAlready) return true;
    const quest = await this.questRepository.getQuest(id);
    if (!quest) {
      throw new NotFoundException(`Quest ${id} not found`);
    }
    const allInCampaign = await this.questRepository.getQuestsByCampaign(
      quest.campaign_id
    );
    const idx = allInCampaign.findIndex((q) => q.id === quest.id);
    if (idx === -1)
      throw new NotFoundException(`Quest ${id} not found in campaign`);
    for (let i = 0; i < idx; i++) {
      const isDone = await this.questRepository.checkQuestCompletion(
        allInCampaign[i].id,
        address
      );
      if (!isDone) {
        throw new BadRequestException(
          `Сначала нужно выполнить квест: ${allInCampaign[i].name}`
        );
      }
    }
    const ok = await this.isQuestFulfilled(quest, address);
    if (!ok) return false;
    await this.questRepository.completeQuest(id, address);
    if (quest.sequence === 1) {
      await this.campaignService.incrementParticipants(quest.campaign_id);
    }
    const doneList =
      await this.questRepository.getCompletedQuestsByUserInCampaign(
        quest.campaign_id,
        address.toLowerCase()
      );
    if (doneList.length === allInCampaign.length) {
      const wasMarked = await this.campaignService.markCampaignAsCompleted(
        quest.campaign_id,
        address.toLowerCase()
      );
      if (wasMarked) {
        const c = await this.campaignService.getCampaignByIdOrSlug(
          quest.campaign_id
        );
        const rewards = c.rewards || [];
        let totalPoints = 0;
        rewards.forEach((r: any) => {
          if (r.type === 'tokens') totalPoints += parseInt(r.value, 10);
        });
        await this.userService.awardCampaignCompletion(
          address.toLowerCase(),
          totalPoints
        );
      }
    }
    return true;
  }

  private async isQuestFulfilled(quest: QuestType, userAddr: string) {
    const task = quest.value;
    if (quest.type === 'link') {
      const link = task.endpoint.replace('{$address}', userAddr);
      const r = await fetch(link);
      if (!r.ok) return false;
      const d = await r.json();
      const fn = new Function('data', `return (${task.expression})(data)`);
      return !!fn(d);
    }
    if (task.chain === 'Ethereum') {
      const url = `https://soneium.blockscout.com/api?module=account&action=eth_get_balance&address=${userAddr}`;
      const r = await fetch(url);
      if (!r.ok) return false;
      const data = await r.json();
      if (!data?.result) return false;
      const bal = ethers.getBigInt(data.result);
      return bal > 0n;
    }
    if (task.method && task.method_equals) {
      const ok = await this.checkMethodExecution(task, userAddr);
      return ok;
    }
    const txList = await this.getTxList(task.chain, userAddr);
    const relevantTxs = txList.filter((tx) => {
      if (!tx.to) return false;
      const toAddr = tx.to.toLowerCase();
      const fromAddr = tx.from?.toLowerCase();
      if (task.contract1) {
        return (
          [task.contract, task.contract1]
            .map((c) => c.toLowerCase())
            .includes(toAddr) && fromAddr === userAddr.toLowerCase()
        );
      }
      return (
        toAddr === task.contract.toLowerCase() &&
        fromAddr === userAddr.toLowerCase()
      );
    });
    if (!relevantTxs.length) return false;
    const okTx = await this.checkTxs(task, userAddr, relevantTxs);
    if (okTx) return true;
    return false;
  }

  private async checkMethodExecution(task: QuestTask, address: string) {
    try {
      if (task.method && task.method_equals) {
        const cAddress = task.contract;
        const minimalAbi = task.abi_to_find;
        const contract = new ethers.Contract(
          cAddress,
          minimalAbi,
          soneiumProvider
        );
        const minted = await contract.hasMinted(address);
        Logger.debug(`hasMinted(${address}) => ${minted}`);
        return minted;
      }
    } catch (error) {
      Logger.debug(`Ошибка проверки hasMinted: ${error.message}`);
    }
    return false;
  }

  private async getTxList(chain: string, addr: string) {
    if (chain !== 'Soneium') return [];
    const now = Math.floor(Date.now() / 1000);
    const weekAgo = now - 14 * 24 * 60 * 60;
    const url = `https://soneium.blockscout.com/api?module=account&action=txlist&address=${addr}&start_timestamp=${weekAgo}&end_timestamp=${now}&page=1&offset=1000&sort=asc`;
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();
    if (!Array.isArray(data?.result)) return [];
    return data.result;
  }

  async checkTxs(task: QuestTask, address: string, txs: any[]) {
    try {
      for (const t of txs) {
        if (task.abi_to_find && task.abi_equals) {
          for (const abi of task.abi_to_find) {
            try {
              const i = new ethers.Interface([abi]);
              const parsed = i.parseTransaction({ data: t.input });
              console.log('parsed------>', parsed);
              if (!parsed || !parsed.args || parsed.args.length < 2) continue;
              const asset = parsed.args[0]?.toLowerCase();
              const amountBN: bigint = parsed.args[1];
              let amountUSD = 0;
              console.log('------>', 12312312312);
              if (task.abi_equals) {
                const eqLen = task.abi_equals.length;
                let count = 0;
                for (const eqArr of task.abi_equals) {
                  for (const eqVal of eqArr) {
                    console.log('eqVal------>', eqVal);
                    if (!asset.includes(eqVal.toLowerCase())) {
                      continue;
                    }
                    count++;
                    if (count === eqLen) {
                      const amt = ethers.formatUnits(amountBN, 18);
                      const coingId =
                        this.tokenToCoingeckoId[eqVal.toLowerCase()];
                      if (!coingId) break;
                      const usd = await this.getUSDValue(
                        eqVal.toLowerCase(),
                        amt
                      );
                      amountUSD += usd;
                      if (amountUSD >= (task.minAmountUSD || 20)) {
                        return true;
                      }
                    }
                  }
                }
              }
            } catch (err) {
              console.log(`Ошибка парсинга транзакции с ABI ${abi}:`, err);
            }
            return false;
          }
        }
      }
    } catch (error) {
      console.log('Ошибка при checkTxs:', error);
    }
    return false;
  }

  private parseMintManual(data: string) {
    if (!data.startsWith('0x')) return null;
    const hex = data.slice(2);
    if (hex.length < 8 + 10 * 64) return null;
    let offset = 8;
    function readWord() {
      const res = hex.slice(offset, offset + 64);
      offset += 64;
      return res;
    }
    const token0 = '0x' + readWord().slice(24).toLowerCase();
    const token1 = '0x' + readWord().slice(24).toLowerCase();
    const feeWord = readWord();
    const tickLWord = readWord();
    const tickUWord = readWord();
    const amt0Word = readWord();
    const amt1Word = readWord();
    const amt0MinW = readWord();
    const amt1MinW = readWord();
    const recWord = readWord();
    const ddlWord = readWord();
    function toBN(x: string) {
      return BigInt('0x' + x);
    }
    const amount0Desired = toBN(amt0Word);
    const amount1Desired = toBN(amt1Word);
    return {
      token0,
      token1,
      fee: Number(toBN(feeWord) & BigInt(0xffffff)),
      tickLower: 0,
      tickUpper: 0,
      amount0Desired,
      amount1Desired,
      amount0Min: toBN(amt0MinW),
      amount1Min: toBN(amt1MinW),
      recipient: '0x' + recWord.slice(24).toLowerCase(),
      deadline: toBN(ddlWord),
    };
  }

  async extractMintAmounts(
    multicallInput: string[]
  ): Promise<{ astrAmount: string } | null> {
    if (!multicallInput?.length) {
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
    const astrAmount = ethers.formatUnits(astrAmountBN, 18);
    Logger.debug(`Извлечены суммы: ASTR = ${astrAmount}`);
    return { astrAmount };
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
}
