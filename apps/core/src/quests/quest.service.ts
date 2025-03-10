import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ethers, parseEther } from 'ethers';
import fetch from 'node-fetch';
import { ConfigService } from '../_config/config.service';
import { CampaignService } from '../campaigns/campaign.service';
import { DiscordBotService } from '../discord/discord.service';
import { PriceService } from '../price/price.service';
import { ArkadaAbi } from '../shared/abi/arkada';
import { randomABI } from '../shared/abi/idk';
import { l2BridgeABI } from '../shared/abi/l2BridgeABI';
import { mintABI } from '../shared/abi/mintABI';
import { MintNewABI } from '../shared/abi/mintNew';
import { newAbi } from '../shared/abi/newAbi';
import { buyABI } from '../shared/abi/newXd';
import { SwapRouterABI } from '../shared/abi/swapRouter';
import { UniswapV3ABI } from '../shared/abi/uniswapV3';
import { UniswapV3PoolABI } from '../shared/abi/uniswapV3Pool';
import { VaultABI } from '../shared/abi/vault-buy-execution';
import { soneiumProvider } from '../shared/provider';
import { UserService } from '../user/user.service';
import { QuestType } from './interface';
import {
  IFeeRecipient,
  IMintPyramidData,
  IRewardData,
  ITransactionData,
  SIGN_TYPES,
} from './interfaces/sign';
import { QuestRepository } from './quest.repository';

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
    '0xba9986d2381edf1da03b0b9c1f8b00dc4aacc369': 'usdc',
    '0x60336f9296c79da4294a19153ec87f8e52158e5f': 'bifrost-voucher-astr',
  };

  constructor(
    private readonly questRepository: QuestRepository,
    private readonly userService: UserService,
    private readonly campaignService: CampaignService,
    private readonly priceService: PriceService,
    private readonly discordService: DiscordBotService,
    private readonly configService: ConfigService
  ) {}

  async getAllCompletedQuestsByUser(address: string) {
    return this.questRepository.getAllCompletedQuestsByUser(address);
  }

  async getCampaignById(id: string) {
    return await this.campaignService.getCampaignByIdOrSlug(id);
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
      const contractAddress =
        '0x181b42ca4856237AE76eE8c67F8FF112491eCB9e'.toLowerCase();
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
    const doneAlready = await this.checkQuestCompletion(id, address);
    if (doneAlready) return true;

    const quest = await this.getQuest(id);
    if (!quest) throw new NotFoundException(`Quest ${id} not found`);
    const campaignQuests = await this.questRepository.getQuestsByCampaign(
      quest.campaign_id
    );

    const idx = campaignQuests.findIndex((q) => q.id === quest.id);
    if (idx < 0) throw new NotFoundException(`Quest ${id} not in campaign`);

    for (let i = 0; i < idx; i++) {
      const prior = campaignQuests[i];
      const priorDone = await this.checkQuestCompletion(prior.id, address);
      if (!priorDone) {
        throw new BadRequestException(`Сначала нужно выполнить: ${prior.name}`);
      }
    }

    const ok = await this.handleQuestLogic(quest, address);
    if (!ok) return false;

    await this.questRepository.completeQuest(id, address);

    if (quest.sequence === 1) {
      await this.campaignService.incrementParticipants(quest.campaign_id);
    }

    const allDone = await this.getCompletedQuestsByUserInCampaign(
      quest.campaign_id,
      address.toLowerCase()
    );
    if (allDone.length === campaignQuests.length) {
      const wasMarked = await this.campaignService.markCampaignAsCompleted(
        quest.campaign_id,
        address.toLowerCase()
      );
      if (wasMarked) {
        const c = await this.campaignService.getCampaignByIdOrSlug(
          quest.campaign_id
        );
        let totalPoints = 0;
        for (const r of c.rewards || []) {
          if (r.type === 'tokens') totalPoints += parseInt(r.value, 10);
        }
        if (totalPoints > 0) {
          await this.userService.awardCampaignCompletion(
            address.toLowerCase(),
            totalPoints
          );
        }
      }
    }
    return true;
  }

  private async handleQuestLogic(quest: QuestType, userAddr: string) {
    if (quest.type === 'link') {
      return this.handleLinkQuest(quest, userAddr);
    }
    if (quest.type === 'discord') {
      const user = await this.userService.findByAddress(userAddr);
      if (!user || !user.discord) {
        return false;
      }
      return await this.discordService.isUserInGuildByUsername(
        quest.value.guildId,
        user.discord
      );
    }
    if (quest.value.type === 'checkMethod') {
      return this.handleCheckMethodQuest(quest, userAddr);
    }
    if (quest.value.type === 'checkOnchainMethod') {
      return this.handleCheckOnchainMethodQuest(quest, userAddr);
    }
    return this.checkOnChainQuest(quest, userAddr);
  }

  private async handleLinkQuest(quest: QuestType, userAddr: string) {
    const task = quest.value;
    if (task.contract) {
      try {
        const contract = new ethers.Contract(
          task.contract,
          ['function hasMinted(address) view returns (bool)'],
          soneiumProvider
        );
        const minted = await contract.hasMinted(userAddr);
        return !!minted;
      } catch {
        return false;
      }
    }
    if (task.endpoint) {
      let finalUrl = task.endpoint.replace('{$address}', userAddr);
      if (task.params)
        finalUrl = this.buildLinkUrl(task.endpoint, task.params, userAddr);
      const res = await fetch(finalUrl);
      if (!res.ok) return false;
      const data = await res.json();
      if (task.expression) {
        const fn = new Function('data', `return (${task.expression})(data);`);
        return !!fn(data);
      }
      return !!data.verified;
    }
    return false;
  }

  private async handleCheckOnchainMethodQuest(
    quest: QuestType,
    userAddr: string
  ) {
    const contractAddress = quest.value.contracts[0].toLowerCase();
    const abi = quest.value.actions
      ? quest.value.actions[0].methodSignatures
      : quest.value.methodSignatures;

    const iface = new ethers.Interface(abi);

    const transactions = await this.getUserTransactions(
      'Soneium',
      userAddr,
      quest
    );

    const contractTransactions = transactions.filter(
      (tx) => tx.to.toLowerCase() === contractAddress
    );

    console.log(`Transactions found for user ${contractTransactions.length}`);

    for (const tx of contractTransactions) {
      try {
        const parsed = iface.parseTransaction({ data: tx.input });

        if (parsed.name === 'checkIn') {
          return true;
        }
        if (parsed.name === 'safeTransferFrom') {
          return true;
        }

        if (quest.value.methodToFind) {
          for (let i = 0; i <= quest.value.methodToFind.length; i++) {
            if (parsed.name === quest.value.methodToFind[i]) {
              return true;
            }
          }
        }

        if (parsed.name === 'execute') {
          const inputs = parsed.args[1];
          if (inputs.length > 2) {
            continue;
          }
          for (const encodedInput of inputs) {
            try {
              const data = encodedInput.replace(/^0x/, '').toLowerCase();

              const chunkSize = 64;
              const chunks = data.match(new RegExp(`.{1,${chunkSize}}`, 'g'));

              if (!chunks || chunks.length < 2) {
                return null;
              }

              const valueHex = '0x' + chunks[1];

              const valueWei = BigInt(valueHex);

              const depositAmount = ethers.formatUnits(valueWei, 18);
              Logger.debug(`Deposit amount (raw): ${depositAmount}`);

              const depositUSDValue = await this.convertToUSD(
                '0x4200000000000000000000000000000000000006',
                valueWei
              );
              const token0 =
                '4200000000000000000000000000000000000006'.toLowerCase();
              const token1 =
                '2CAE934a1e84F693fbb78CA5ED3B0A6893259441'.toLowerCase();
              const minLimit = quest.value.actions[0].minUsdTotal;
              const dataLC = encodedInput.toLowerCase();
              const isPairValid =
                encodedInput.toLowerCase().includes(token0) &&
                encodedInput.toLowerCase().includes(token1);
              const isAmountValid = depositUSDValue >= minLimit;
              if (isPairValid && isAmountValid) {
                return true;
              } else {
                console.log('❌ Квест не выполнен.');
                continue;
              }
            } catch (error) {
              continue;
            }
          }
        }
      } catch (e) {
        continue;
      }
    }

    return false;
  }

  private async handleCheckMethodQuest(quest: QuestType, userAddr: string) {
    const task = quest.value;
    try {
      const contract = new ethers.Contract(
        task.contracts[0],
        task.methodSignatures,
        soneiumProvider
      );

      let newBalance;
      if (task.methodSignatures[0].includes('uint256 id')) {
        newBalance = await contract.balanceOf(userAddr, 0);
      } else {
        newBalance = await contract.balanceOf(userAddr);
      }
      return newBalance > 0;
    } catch (e) {
      return false;
    }
  }

  private buildLinkUrl(endpoint: string, paramsStr: string, address: string) {
    const replaced = paramsStr.replace(/\$\{address\}/g, `"${address}"`);
    let jsonStr = replaced.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
    jsonStr = jsonStr.replace(/:\s*(0x[0-9a-fA-F]+)/g, ': "$1"');

    const paramsObj = JSON.parse(jsonStr);
    if (paramsObj.minOutputAmount) {
      paramsObj.minOutputAmount = Number(paramsObj.minOutputAmount) * 1000000;
    }
    const qs = new URLSearchParams(paramsObj).toString();
    return `${endpoint}?${qs}`;
  }

  private async checkOnChainQuest(quest: QuestType, userAddr: string) {
    const data = quest.value;
    if (
      data.actions &&
      !data.actions[0]?.minUsdTotal &&
      !data.actions[0]?.contracts
    ) {
      const ok = await this.checkTokenBalanceQuest(
        data.actions[0].tokens[0].address,
        userAddr,
        data.actions[0].methodSignatures,
        data.actions[0].tokens[0].minAmountToken
      );
      if (ok) return true;
      return false;
    }

    const chain = quest.value.chain || 'Soneium';

    const c = await this.getCampaignById(quest.campaign_id);

    const txs = await this.getUserTransactions(chain, userAddr, c);
    if (!txs.length) return false;
    const txnsToAddress = txs.filter(
      (tx) =>
        tx.to.toLowerCase() === quest.value.contracts[0].toLowerCase() ||
        tx.to.toLowerCase() === quest.value.contracts[1]?.toLowerCase() ||
        tx.to.toLowerCase() === quest.value.contracts[2]?.toLowerCase()
    );
    console.log('------>', txnsToAddress.length);

    for (const tx of txnsToAddress) {
      if (!data.minAmountUSD && !data.actions && data.methodSignatures) {
        const ok = await this.checkBuyNFTQuest(tx, data.methodSignatures);
        if (ok) return true;
        return false;
      }
      if (quest.value.type === 'checkInputData') {
        if (
          tx.input.startsWith('0xac9650d8') &&
          tx.input
            .toLowerCase()
            .includes('2CAE934a1e84F693fbb78CA5ED3B0A6893259441'.toLowerCase())
        ) {
          return true;
        }
      }
      const ok = await this.parseOnchainTx(tx, data.actions);
      if (ok) return true;
    }

    return false;
  }

  private async checkTokenBalanceQuest(
    tokenAddress: string,
    userAddress: string,
    abi: any,
    amount: number
  ) {
    const contract = new ethers.Contract(tokenAddress, abi, soneiumProvider);

    const balance = abi[0].includes('uint256 id)')
      ? await contract.balanceOf(userAddress, 0)
      : await contract.balanceOf(userAddress);

    if (+balance.toString() < amount) {
      return false;
    }
    return true;
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

    const callData = parsedTx.args[1] as string;

    const result = this.parseTokensAndAmount(callData);
    return result;
  }

  parseTokensAndAmount(hexData: string) {
    const data = hexData.startsWith('0x') ? hexData.slice(2) : hexData;

    const tokenAHex = '2cae934a1e84f693fbb78ca5ed3b0a6893259441';
    const tokenBHex = '4200000000000000000000000000000000000006';

    const idxA = data.indexOf(tokenAHex.toLowerCase());
    const idxB = data.indexOf(tokenBHex.toLowerCase());

    if (idxA === -1 || idxB === -1) {
      return null;
    }

    const next32 = data.slice(
      idxB + tokenBHex.length + 215,
      idxB + tokenBHex.length + 226
    );
    if (!next32) {
      return null;
    }
    const amount = BigInt('0x' + next32);

    return {
      tokenA: '0x' + tokenAHex,
      tokenB: '0x' + tokenBHex,
      amount,
    };
  }

  private async checkBuyNFTQuest(tx: any, abi: any) {
    for (const abiStr of abi) {
      const iface = new ethers.Interface([abiStr]);
      let parsed;
      try {
        parsed = iface.parseTransaction({ data: tx.input });
      } catch (e) {
        continue;
      }
      if (!parsed) continue;

      if (parsed.name === 'buy') {
        return true;
      }
    }
    return false;
  }

  private async parseOnchainTx(tx: any, actions: any[]): Promise<boolean> {
    const rawInput = tx.input || '';
    if (!rawInput.startsWith('0x')) return false;
    console.log('------>', tx.hash);
    const ok = await this.parseOnchainData(rawInput, actions, tx);
    return ok;
  }

  private async parseOnchainData(
    hexData: string,
    actions: any[],
    parentTx: any
  ): Promise<boolean> {
    for (const action of actions) {
      const signatures: string[] = action.methodSignatures || [];
      for (const sig of signatures) {
        let parsedTx: ethers.TransactionDescription | null = null;
        try {
          const iface = new ethers.Interface([sig]);
          parsedTx = iface.parseTransaction({ data: hexData });
        } catch (err) {
          continue;
        }

        if (!parsedTx) {
          continue;
        }

        const methodName = parsedTx.name.toLowerCase();
        if (methodName === 'multicall') {
          const subcalls: string[] = parsedTx.args[0];
          let subcallSuccess = false;

          for (const subData of subcalls) {
            const ok = await this.parseOnchainData(subData, actions, parentTx);
            if (ok) {
              subcallSuccess = true;
              break;
            }
          }

          if (subcallSuccess) {
            return true;
          } else {
            continue;
          }
        }
        if (methodName === 'depositTokenDelegate') {
          // Проверяем логи
          const eventOk = await this.parseNeemoDepositEvent(parentTx.hash);
          if (eventOk) {
            // Квест выполнен
            return true;
          }
        }
        if (methodName === 'swap') {
          let totalUsdValue = 0;
          const request = parsedTx.args[0];
          const routes = request[3];
          const lastToken = request[2][0];
          if (
            lastToken.toLowerCase() !==
            '0x2CAE934a1e84F693fbb78CA5ED3B0A6893259441'.toLowerCase()
          ) {
            return false;
          }

          for (const route of routes) {
            const tokenAddr = route[0] as string;
            if (
              tokenAddr.toLowerCase() !==
              '0x4200000000000000000000000000000000000006'
            ) {
              continue;
            }
            const amountBN = route[1] as bigint;
            const usdValueForRoute = await this.convertToUSD(
              tokenAddr.toLowerCase(),
              parentTx.value
            );

            totalUsdValue = usdValueForRoute;
          }

          Logger.debug(`Total swap USD value: ${totalUsdValue}`);
          if (totalUsdValue >= (action.minUsdTotal || 0)) {
            return true;
          }
        } else {
          const sumUSD = await this.checkActionTokens(
            action,
            parsedTx,
            parentTx
          );
          if (sumUSD >= (action.minUsdTotal || 0)) {
            return true;
          } else {
            continue;
          }
        }
      }
    }

    return false;
  }

  private async parseNeemoDepositEvent(txHash: string): Promise<boolean> {
    // 1. Получаем receipt
    const receipt = await soneiumProvider.getTransactionReceipt(txHash);
    if (!receipt || !receipt.logs) return false;

    // 2. Определяем ABI события
    const eventAbi = [
      'event LogDepositTokenDelegate(address indexed user, address indexed delegateTo, uint256 tokenAmount, uint256 lstAmount)',
    ];
    const iface = new ethers.Interface(eventAbi);

    for (const log of receipt.logs) {
      try {
        const parsedLog = iface.parseLog(log);
        if (parsedLog.name === 'LogDepositTokenDelegate') {
          // parsedLog.args.user
          // parsedLog.args.delegateTo
          // parsedLog.args.tokenAmount (BigNumber или bigint)
          // parsedLog.args.lstAmount
          // Тут же можно проверить пороговое значение, user = msg.sender и т.д.
          return true;
        }
      } catch (e) {
        // parseLog бросит ошибку, если топик не совпал — просто игнорируем
        continue;
      }
    }
    return false;
  }

  private async checkActionTokens(
    action: any,
    parsedTx: ethers.TransactionDescription,
    rawTx: any
  ): Promise<number> {
    let totalUsd = 0;

    const actualTokens: { address: string; amount: bigint }[] = [];

    if (parsedTx.signature.includes('supplyCollateralAndBorrow')) {
      const borrowAmountBN = parsedTx.args[2] as bigint;
      const tokenAddr = (parsedTx.args[3] as string).toLowerCase();

      const allowedCollaterals = [
        '0xba9986d2381edf1da03b0b9c1f8b00dc4aacc369'.toLowerCase(),
        '0x4200000000000000000000000000000000000006'.toLowerCase(),
      ];
      if (allowedCollaterals.includes(tokenAddr)) {
        const usdVal = await this.convertToUSD(
          '0x2CAE934a1e84F693fbb78CA5ED3B0A6893259441'.toLowerCase(),
          borrowAmountBN
        );
        return usdVal;
      }
    }

    if (!action.tokens && action.minUsdTotal && action.methodSignatures) {
      const tokenAmountBN = parsedTx.args[0] as bigint;
      const usdVal = await this.convertToUSD(
        '0x2CAE934a1e84F693fbb78CA5ED3B0A6893259441'.toLowerCase(),
        tokenAmountBN
      );
      return usdVal;
    }

    for (const tokenDef of action.tokens || []) {
      const tokenAddr = (tokenDef.address || '').toLowerCase();
      let amountBN = 0n;
      const idx = tokenDef.paramIndex;
      const tokenIdx = tokenDef.paramIndexToken;

      if (idx === undefined || idx === null) continue;

      let argVal;
      let tokenVal;
      if (Array.isArray(parsedTx.args[0])) {
        argVal = parsedTx.args[0][idx];
        tokenVal = parsedTx.args[0][tokenIdx].includes(tokenDef.address)
          ? tokenDef.address
          : parsedTx.args[0][tokenIdx];
      } else {
        argVal = parsedTx.args[idx];
        tokenVal = parsedTx.args[tokenIdx];
      }
      if (!tokenIdx && !tokenVal) {
        actualTokens.push({ address: tokenDef.address, amount: argVal });
      }
      if (
        tokenVal &&
        tokenVal.toString().toLowerCase() !== tokenAddr.toLowerCase()
      )
        continue;
      if (!argVal) continue;
      if (typeof argVal === 'bigint') {
        amountBN = argVal;
      }

      actualTokens.push({ address: tokenVal, amount: amountBN });
    }

    if (action.orderedTokens) {
      for (let i = 0; i < action.tokens.length; i++) {
        const actual = actualTokens[i];
        if (!actual) return 0;
        const def = action.tokens[i];
        if (
          action.tokens[i].paramIndexToken ===
          action.tokens[i + 1]?.paramIndexToken
        ) {
          if (
            !parsedTx.args[0][action.tokens[i].paramIndexToken]
              .toLowerCase()
              .includes(action.tokens[i].address.toLowerCase()) ||
            !parsedTx.args[0][action.tokens[i + 1].paramIndexToken]
              .toLowerCase()
              .includes(action.tokens[i + 1].address.toLowerCase().slice(2))
          ) {
            continue;
          }
          const token0Index = parsedTx.args[0][
            action.tokens[i].paramIndexToken
          ].indexOf(action.tokens[i].address);
          const token1Index = parsedTx.args[0][
            action.tokens[i + 1].paramIndexToken
          ].indexOf(action.tokens[i + 1]?.address);
          if (token0Index < token1Index) {
            return 0;
          }
          const usdVal = await this.convertToUSD(
            action.tokens[i].address.toLowerCase(),
            actual.amount
          );
          return (totalUsd += usdVal);
        } else {
          if (!actual) return 0;
          if (def.address.toLowerCase() !== actual.address.toLowerCase()) {
            return 0;
          }
          if ((def.minAmountToken || 0) > 0) {
            //свериться с минимальным кол-вом если есть
          }
          const usdVal = await this.convertToUSD(actual.address, actual.amount);
          totalUsd += usdVal;
        }
      }
    } else {
      for (const def of action.tokens) {
        const found = actualTokens.find(
          (t) =>
            t.address && t.address.toLowerCase() === def.address.toLowerCase()
        );
        if (!found) {
          return 0;
        }
        if ((def.minAmountToken || 0) > 0) {
          // 466 same
        }
        const usdVal = await this.convertToUSD(found.address, found.amount);
        totalUsd += usdVal;
      }
    }
    return totalUsd;
  }

  private async convertToUSD(
    tokenAddr: string,
    amountBN: bigint
  ): Promise<number> {
    if (!amountBN || amountBN === 0n) return 0;
    const decimals =
      tokenAddr.toLowerCase() === '0xba9986d2381edf1da03b0b9c1f8b00dc4aacc369'
        ? 6
        : 18;
    const floatAmount = parseFloat(ethers.formatUnits(amountBN, decimals));
    if (
      tokenAddr.toLowerCase() === '0xba9986d2381edf1da03b0b9c1f8b00dc4aacc369'
    ) {
      return floatAmount * 1;
    }
    const coingeckoKey =
      this.tokenToCoingeckoId[tokenAddr.toLowerCase()] || 'ethereum';
    const price = await this.priceService.getTokenPrice(coingeckoKey);
    if (!price) return 0;
    return floatAmount * price;
  }

  private async getUserTransactions(
    chain: string,
    addr: string,
    campaign: any
  ) {
    if (chain !== 'Soneium') return [];
    const now = Math.floor(Date.now() / 1000);
    const startedAt = Math.floor(campaign.started_at / 1000);
    const ignoreStart = campaign.ignore_campaign_start;
    let startTs = ignoreStart ? now - 14 * 24 * 60 * 60 : startedAt;
    if (startTs < 0) startTs = 0;
    const url = `https://soneium.blockscout.com/api?module=account&action=txlist&address=${addr}&start_timestamp=${startTs}&end_timestamp=${now}&page=0&offset=500&sort=desc`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const data = await r.json();
    if (!data || !Array.isArray(data.result)) return [];
    return data.result;
  }

  async getSignedMintData(idOrSlug: string, userAddress: string) {
    const campaign = await this.campaignService.getCampaignByIdOrSlug(idOrSlug);
    if (!campaign) {
      throw new BadRequestException('Campaign not found');
    }

    console.log('campaign', campaign);

    const chainId = this.configService.getOrThrow('SIGN_DOMAIN_CHAIN_ID');

    const signDomain = {
      name: this.configService.getOrThrow('SIGN_DOMAIN_NAME'),
      version: this.configService.getOrThrow('SIGN_DOMAIN_VERSION'),
      chainId,
      verifyingContract: this.configService.getOrThrow(
        'PYRAMID_CONTRACT_ADDRESS'
      ),
    };

    const completedQuests =
      await this.questRepository.getCompletedQuestsByUserInCampaign(
        campaign.id,
        userAddress
      );

    console.log('completedQuests', completedQuests);

    if (!completedQuests.length) {
      throw new BadRequestException(
        'No completed quests found for this campaign'
      );
    }
    // if (completedQuests.length !== campaign.quests.length) {
    //   throw new BadRequestException('All quests must be completed');
    // }

    const user = await this.userService.findByAddress(userAddress);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const transactions = completedQuests.map<ITransactionData>((quest) => {
      return {
        // txHash: quest.tx_hash,
        txHash:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        networkChainId: chainId,
      };
    });

    const recipients: IFeeRecipient[] = user.ref_owner
      ? [
          {
            recipient: user.ref_owner, //ref_owner is the address of the user who referred the user
            BPS: 100, // 10000 BPS = 100%
          },
        ]
      : [];

    const rewardAmount = parseEther('0.01');

    const reward: IRewardData = {
      tokenAddress: ethers.ZeroAddress,
      chainId: parseInt(chainId),
      amount: rewardAmount,
      tokenId: 0,
      tokenType: 0,
      rakeBps: 0,
      factoryAddress: ethers.ZeroAddress,
    };

    const nonce = Math.floor(Date.now() / 1000); // Current timestamp as nonce
    const MINT_PRICE = parseEther('0.01');

    // // Since we don't store transaction data in quest_completions,
    // // we'll use dummy values that will be replaced on the frontend
    const pyramidData: IMintPyramidData = {
      questId: campaign.id,
      nonce,
      price: MINT_PRICE,
      toAddress: userAddress,
      walletProvider: 'metamask', // Default wallet provider
      tokenURI: '',
      embedOrigin: 'Arkada',
      transactions,
      recipients,
      reward,
    };

    // // Get the private key for signing
    const privateKey = this.configService.getOrThrow(
      'PYRAMID_SIGNER_PRIVATE_KEY'
    );
    const wallet = new ethers.Wallet(privateKey);

    // // Sign the data
    const signature = await wallet.signTypedData(
      signDomain,
      SIGN_TYPES,
      pyramidData
    );

    console.log('signature', signature);

    // return {
    //   domain: signDomain,
    //   types: SIGN_TYPES,
    //   value: pyramidData,
    //   signature,
    // };
  }
}
