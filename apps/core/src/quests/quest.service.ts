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
    ethereum: 'ethereum',
    astroport: 'astar',
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

  async getQuestValue(id: string): Promise<any> {
    const quest: QuestType = await this.questRepository.getQuest(id);
    return quest.value;
  }

  async getQuest(id: string): Promise<QuestType> {
    const quest: QuestType = await this.questRepository.getQuest(id);
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
    const weekAgoUnix = nowUnix - 7 * 24 * 60 * 60;

    const queryParams = new URLSearchParams({
      module: 'account',
      action: 'txlist',
      address: address,
      start_timestamp: weekAgoUnix.toString(),
      end_timestamp: nowUnix.toString(),
      page: '1',
      offset: '1000',
      sort: 'asc',
      // filter_by: 'to',
    });

    return `${baseUrl}/api?${queryParams.toString()}`;
  }

  async checkQuest(id: string, address: string): Promise<boolean> {
    const completed = await this.questRepository.checkQuestCompletion(
      id,
      address
    );
    if (completed) return true;
    const quest: QuestType = await this.questRepository.getQuest(id);
    if (!quest) throw new NotFoundException(`Quest ${id} not found`);

    const allQuests = await this.questRepository.getQuestsByCampaign(
      quest.campaign_id
    );
    const idx = allQuests.findIndex((q) => q.id === quest.id);
    if (idx === -1)
      throw new NotFoundException(`Quest ${id} not found in campaign`);
    for (let i = 0; i < idx; i++) {
      const done = await this.questRepository.checkQuestCompletion(
        allQuests[i].id,
        address
      );
      if (!done)
        throw new BadRequestException(
          `Сначала нужно выполнить квест: ${allQuests[i].name}`
        );
    }
    console.log('------>', 123999);
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
    if (doneList.length === allQuests.length) {
      const marked = await this.campaignService.markCampaignAsCompleted(
        quest.campaign_id,
        address.toLowerCase()
      );
      if (marked) {
        const camp = await this.campaignService.getCampaignByIdOrSlug(
          quest.campaign_id
        );
        const rewards = camp.rewards || [];
        let totalPoints = 0;
        rewards.forEach((r: any) => {
          if (r.type === 'tokens') totalPoints += parseInt(r.value, 10);
        });
        await this.userService.updatePoints(address.toLowerCase(), totalPoints);
      }
    }
    return true;
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
    const task = questTask;
    if (quest.quest_type === 'link') {
      console.log('------>', 1231);
      const link = task.endpoint.replace('{$address}', address);
      const resp = await fetch(link);
      if (!resp.ok) return false;
      const data = await resp.json();
      const fn = new Function('data', `return (${task.expression})(data)`);
      return !!fn(data);
    }
    if (task.chain === 'Ethereum') {
      const balUrl = `https://soneium.blockscout.com/api?module=account&action=eth_get_balance&address=${address}`;
      const r = await fetch(balUrl);
      if (!r.ok) return false;
      const d = await r.json();
      if (!d?.result) return false;
      const bal = ethers.getBigInt(d.result);
      return bal > 0n;
    }
    const txList = await this.getTxList(task.chain, address);
    const filtered = txList.filter(
      (tx) =>
        tx.from?.toLowerCase() === address.toLowerCase() &&
        (task.contract1
          ? [task.contract, task.contract1]
              .map((c) => c.toLowerCase())
              .includes(tx.to?.toLowerCase() || '')
          : tx.to?.toLowerCase() === task.contract.toLowerCase())
    );
    if (!filtered.length) return false;

    if (task.abi_to_find?.some((f) => f.includes('function supply'))) {
      const ok = await this.checkSupplyTxs(filtered, task, address);
      if (ok) return true;
      return false;
    }
    if (task.abi_to_find?.some((f) => f.includes('function borrow'))) {
      const ok = await this.checkBorrowTxs(filtered, task, address);
      if (ok) return true;
      return false;
    }
    if (task.abi_to_find?.some((f) => f.includes('function buy'))) {
      const ok = await this.checkBuyTxs(filtered, task, address);
      if (ok) return true;
      return false;
    }
    if (task.abi_to_find?.some((f) => f.includes('function mint'))) {
      const ok = await this.checkMintTxs(filtered, task, address);
      if (ok) return true;
      return false;
    }
    for (const tx of filtered) {
      const ok = await this.decodeAndCheck(tx, task, address);
      if (ok) return true;
    }
    return false;
  }

  private async getTxList(chain: string, addr: string) {
    if (chain !== 'Soneium') return [];
    const now = Math.floor(Date.now() / 1000);
    const weekAgo = now - 7 * 24 * 60 * 60;
    const url = `https://soneium.blockscout.com/api?module=account&action=txlist&address=${addr}&start_timestamp=${weekAgo}&end_timestamp=${now}&page=1&offset=1000&sort=asc`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const d = await r.json();
    if (!Array.isArray(d.result)) return [];
    return d.result;
  }

  private async decodeAndCheck(tx: any, task: QuestTask, userAddr: string) {
    const provider = task.chain === 'Soneium' ? soneiumProvider : ethProvider;
    const realTx = await provider.getTransaction(tx.hash);
    if (!realTx) return false;
    const abi = this.contractAbiMap[task.contract.toLowerCase()] || [];
    let parsed;
    try {
      const iface = new ethers.Interface(abi);
      parsed = iface.parseTransaction({
        data: realTx.data,
        value: realTx.value,
      });
    } catch {
      return false;
    }
    return !!parsed;
  }

  private async checkSupplyTxs(txs: any[], task: QuestTask, user: string) {
    for (const t of txs) {
      try {
        for (const taskABI in task.abi_to_find) {
          const abi = [taskABI];
          const i = new ethers.Interface(abi);
          const parsed = i.parseTransaction({ data: t.input });
          const asset = parsed.args[0]?.toLowerCase();
          const amountBN: bigint = parsed.args[1];
          if (asset !== '0x2cae934a1e84f693fbb78ca5ed3b0a6893259441') continue;
          const depositAmount = ethers.formatUnits(amountBN, 18);
          const depositUSD = await this.getUSDValue('astroport', depositAmount);
          if (depositUSD >= (task.minAmountUSD || 20)) return true;
        }
      } catch (err) {
        console.log('------>', err);
      }
    }
    return false;
  }

  private async checkBorrowTxs(txs: any[], task: QuestTask, user: string) {
    for (const t of txs) {
      try {
        for (const taskABI in task.abi_to_find) {
          const abi = [taskABI];
          const i = new ethers.Interface(abi);
          const parsed = i.parseTransaction({ data: t.input });
          const asset = parsed.args[0]?.toLowerCase();
          const amountBN: bigint = parsed.args[1];
          if (asset !== '0xba9986d2381edf1d03b0b9c1f8b00dc4aacc369') continue;
          const borrowAmount = ethers.formatUnits(amountBN, 6);
          if (parseFloat(borrowAmount) >= (task.minAmountUSD || 0)) return true;
        }
      } catch (err) {
        console.log('------>', err);
      }
    }
    return false;
  }

  private async checkBuyTxs(txs: any[], task: QuestTask, user: string) {
    for (const t of txs) {
      try {
        if (
          t.input.startsWith('0xac9650d8') &&
          t.input
            .toLowerCase()
            .includes('2cae934a1e84f693fbb78ca5ed3b0a6893259441')
        ) {
          return true;
        }
      } catch (err) {
        console.log('------>', err);
      }
    }
    return false;
  }

  private async checkMintTxs(txs: any[], task: QuestTask, user: string) {
    for (const t of txs) {
      try {
        const multi = ['function multicall(bytes[] data)'];
        const iface = new ethers.Interface(multi);
        const parsed = iface.parseTransaction({ data: t.input });
        if (!parsed) continue;
        const callDataArray = parsed.args[0];
        if (!Array.isArray(callDataArray) || !callDataArray.length) continue;
        const info = this.parseMintManual(callDataArray[0]);
        if (!info) continue;
        const token0 = info.token0.toLowerCase();
        const token1 = info.token1.toLowerCase();
        if (
          token0 !== '0x2cae934a1e84f693fbb78ca5ed3b0a6893259441' &&
          token1 !== '0x2cae934a1e84f693fbb78ca5ed3b0a6893259441'
        ) {
          continue;
        }
        const secondAddr = task.abi_equals?.[0]?.[1]?.toLowerCase() || '';
        const astrBN =
          token0 === '0x2cae934a1e84f693fbb78ca5ed3b0a6893259441'
            ? info.amount0Desired
            : info.amount1Desired;
        const otherBN =
          token0 === secondAddr
            ? info.amount0Desired
            : token1 === secondAddr
            ? info.amount1Desired
            : 0n;
        const astrAmount = ethers.formatUnits(astrBN, 18);
        const otherAmount = ethers.formatUnits(otherBN, 18);
        const astrUSD = await this.getUSDValue('astroport', astrAmount);
        const otherUSD = await this.getUSDValue('ethereum', otherAmount);
        if (astrUSD + otherUSD >= (task.minAmountUSD || 20)) {
          return true;
        }
      } catch (err) {
        console.log('------>', err);
      }
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

  // async getQuestValue(id: string): Promise<any> {
  //   const quest: QuestType = await this.questRepository.getQuest(id);
  //   return quest.value;
  // }

  // async getQuest(id: string): Promise<QuestType> {
  //   const quest: QuestType = await this.questRepository.getQuest(id);
  //   return quest;
  // }
}
