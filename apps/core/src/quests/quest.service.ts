import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ethers } from 'ethers';
import fetch from 'node-fetch';
import { ConfigService } from '../_config/config.service';
import { CampaignService } from '../campaigns/campaign.service';
import { DiscordBotService } from '../discord/discord.service';
import { IpfsService } from '../ipfs/ipfs.service';
import { PriceService } from '../price/price.service';
import { ArkadaAbi } from '../shared/abi/arkada.abi';
import { l2BridgeABI } from '../shared/abi/l2Bridge.abi.';
import { mintABI } from '../shared/abi/mint.abi';
import { MintNewABI } from '../shared/abi/mintNew.abi';
import { MulticallAbi } from '../shared/abi/multicall.abi';
import { newAbi } from '../shared/abi/new.abi';
import { SwapRouterABI } from '../shared/abi/swapRouter.abi';
import { UniswapV3ABI } from '../shared/abi/uniswapV3.abi';
import { UniswapV3PoolABI } from '../shared/abi/uniswapV3Pool.abi';
import { VaultABI } from '../shared/abi/vault-buy-execution.abi';
import {
  ARKADA_NFTS,
  SONEIUM_MULTICALL_ADDRESS,
} from '../shared/constants/addresses';
import { CHAIN_ID, CHAIN_NAME, SUPPORTED_CHAIN_IDS } from '../shared/constants/chain';
import { PyramidType } from '../shared/interfaces';
import { soneiumProvider } from '../shared/provider';
import { UserService } from '../user/user.service';
import {
  ARKADA_NFTS_MULTIPLIER_BPS,
  MAX_BPS,
  MINT_PRICE,
  PYRAMID_IMAGE_URI,
  REF_OWNER_BPS,
  USER_REWARD_BPS,
} from './constants/mint';
import { QuestType } from './interface';
import {
  IFeeRecipient,
  IMintPyramidData,
  IRewardData,
  ITransactionData,
  SIGN_TYPES,
} from './interface/sign';
import { QuestRepository } from './quest.repository';

@Injectable()
export class QuestService {
  private readonly logger = new Logger(QuestService.name);
  private readonly contractAbiMap: { [addr: string]: any } = {
    '0xdef357d505690f1b0032a74c3b581163c23d1535': SwapRouterABI,
    '0x6f5f9d55f727928b644b04d987b1c0cf50af8c0b': UniswapV3ABI,
    '0xcC943afF0F3F8746CCbC3f54BB8869176dBb17F3': ArkadaAbi,
    '0xeb9bf100225c214efc3e7c651ebbadcf85177607': l2BridgeABI,
    '0x43a91c353620b18070ad70416f1667250a75daed': mintABI,
    '0xae2b32e603d303ed120f45b4bc2ebac314de080b': newAbi,
    '0xe15bd143d36e329567ae9a176682ab9fafc9c3d2': UniswapV3PoolABI,
    '0x39df84267fda113298d4794948b86026efd47e32': MintNewABI,
    '0x580DD7a2CfC523347F15557ad19f736F74D5677c': VaultABI,
  };

  private readonly tokenToCoingeckoId: { [token: string]: string } = {
    '0x4200000000000000000000000000000000000006': 'ethereum',
    '0x2cae934a1e84f693fbb78ca5ed3b0a6893259441': 'astar',
    '0xba9986d2381edf1da03b0b9c1f8b00dc4aacc369': 'usdc',
    '0x29219dd400f2bf60e5a23d13be72b486d4038894': 'usdc',
    '0x60336f9296c79da4294a19153ec87f8e52158e5f': 'bifrost-voucher-astr',
    '0xa04bc7140c26fc9bb1f36b1a604c7a5a88fb0e70': 'swapx-2',
  };

  constructor(
    private readonly questRepository: QuestRepository,
    private readonly userService: UserService,
    private readonly campaignService: CampaignService,
    private readonly priceService: PriceService,
    private readonly discordService: DiscordBotService,
    private readonly configService: ConfigService,
    private readonly ipfsService: IpfsService
  ) { }

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

  async hasMintedNfts(
    userAddress: string,
    nftAddresses: ARKADA_NFTS[]
  ): Promise<Record<ARKADA_NFTS, boolean>> {
    try {
      const minimalAbi = ['function hasMinted(address) view returns (bool)'];
      const iface = new ethers.Interface(minimalAbi);

      // Prepare multicall data
      const calls = nftAddresses.map((address) => ({
        target: address.toLowerCase(),
        callData: iface.encodeFunctionData('hasMinted', [userAddress]),
      }));

      // Create multicall contract instance
      const multicallContract = new ethers.Contract(
        SONEIUM_MULTICALL_ADDRESS,
        MulticallAbi,
        soneiumProvider
      );

      // Execute multicall
      const { returnData } = await multicallContract.aggregate.staticCall(
        calls
      );

      return nftAddresses.reduce((acc, address, index) => {
        try {
          const decoded = iface.decodeFunctionResult(
            'hasMinted',
            returnData[index]
          );
          return { ...acc, [address]: decoded[0] };
        } catch (error) {
          Logger.error(
            `Error decoding result for ${address}: ${error.message}`
          );
          return { ...acc, [address]: false };
        }
      }, {} as Record<ARKADA_NFTS, boolean>);
    } catch (error) {
      Logger.error(`Error in hasMintedNfts: ${error.message}`);
      throw new InternalServerErrorException(
        `Error in hasMintedNfts: ${error.message}`
      );
    }
  }
  async completeCampaignAndAwardPoints(
    campaignId: string,
    userAddress: string,
    completeAnyway: boolean,
    campaignTotalQuests?: number
  ) {
    const lowerAddress = userAddress.toLowerCase();
    try {
      const campaign = await this.campaignService.getCampaignByIdOrSlug(
        campaignId
      );
      // if PYRAMID mint required and we call method from not webhook, then we don't need to mark campaign as completed
      if (campaign.pyramid_required && !completeAnyway) return;

      const allCampaignQuests =
        campaignTotalQuests ??
        (await this.questRepository.getQuestsByCampaign(campaignId)).length;
      const completedQuests =
        await this.questRepository.getCompletedQuestsByUserInCampaign(
          campaignId,
          lowerAddress
        );
      if (completedQuests.length === allCampaignQuests) {
        const wasMarked = await this.campaignService.markCampaignAsCompleted(
          campaignId,
          lowerAddress
        );
        if (wasMarked) {
          const rewards = campaign.rewards;
          let totalPoints = 0;
          rewards.forEach((r: any) => {
            if (r.type === 'tokens') totalPoints += parseInt(r.value, 10);
          });

          const nftConfigs = [
            {
              address:
                '0x2877Da93f3b2824eEF206b3B313d4A61E01e5698'.toLowerCase(),
              multiplier: 1.1,
            },
            {
              address:
                '0x181b42ca4856237AE76eE8c67F8FF112491eCB9e'.toLowerCase(),
              multiplier: 1.2,
            },
            {
              address: '0xFAC5f5ccDc024BDDF9b0438468C27214E1b4C9f2'.toLowerCase(),
              multiplier: 1.3
            }
          ];


          //TODO: use multicall

          const userMultiplier = Math.max(...await Promise.all(nftConfigs.map(async nft => {
            const contract = new ethers.Contract(
              nft.address,
              ['function balanceOf(address owner) view returns (uint256)'],
              soneiumProvider
            );
            const balance = await contract.balanceOf(lowerAddress);
            return Number(balance) > 0 && nft.multiplier
          }))) || 1;

          const effectivePoints = Math.floor(totalPoints * userMultiplier);
          await this.userService.awardCampaignCompletion(
            lowerAddress,
            effectivePoints,
            campaignId
          );
        }
      }

      return campaign;
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

      await this.completeCampaignAndAwardPoints(
        questStored.campaign_id,
        userAddress,
        false,
        allInCampaign.length
      );

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
    if (!ok.success) return false;

    await this.questRepository.completeQuest(id, address, ok.tx_hash);

    if (quest.sequence === 1) {
      await this.campaignService.incrementParticipants(quest.campaign_id);
    }

    await this.completeCampaignAndAwardPoints(
      quest.campaign_id,
      address,
      false,
      campaignQuests.length
    );

    return true;
  }

  private async handleQuestLogic(quest: QuestType, userAddr: string): Promise<{ success: boolean, tx_hash?: string }> {
    const startTime = Date.now();
    if (quest.type === 'link') {
      return this.handleLinkQuest(quest, userAddr);
    }
    if (quest.type === 'discord') {
      const user = await this.userService.findByAddress(userAddr);
      if (!user || !user.discord) {
        return { success: false }
      }
      return await this.discordService.isUserInGuildByUsername(
        quest.value.guildId,
        user.discord
      );
    }
    if (quest.value.type === 'checkMethod') {
      return this.handleCheckMethodQuest(quest, userAddr);
    }
    if (quest.value.type === 'onchainCheckAmountOfTxns') {
      return this.handleOnchainCheckAmountOfTxns(quest, userAddr);
    }
    if (quest.value.type === 'checkOnchainMethod') {
      return this.handleCheckOnchainMethodQuest(quest, userAddr);
    }
    const endTime = Date.now();
    this.logger.log(`UserTRansactionFromBlockscout ---> latency: ${endTime - startTime}ms`);
    return this.checkOnChainQuest(quest, userAddr);
  }

  private async handleLinkQuest(quest: QuestType, userAddr: string): Promise<{ success: boolean, tx_hash?: string }> {
    const task = quest.value;
    if (task.contract) {
      try {
        const contract = new ethers.Contract(
          task.contract,
          ['function hasMinted(address) view returns (bool)'],
          soneiumProvider
        );
        const minted = await contract.hasMinted(userAddr);
        return { success: !!minted }
      } catch {
        return { success: false }
      }
    }
    if (task.url) {
      const c = await this.campaignService.getCampaignByIdOrSlug(
        quest.campaign_id
      );
      const finalUrl = task.url.replace('{$address}', userAddr);
      const res = await fetch(finalUrl);
      const responseJson = await res.json();
      const campaignStart = new Date(c.started_at);
      const matchingCount = responseJson.data.filter((item: any) => {
        const createdAt = new Date(item.createdAt);
        return createdAt > campaignStart;
      }).length;

      this.logger.debug(`Найдено записей после начала кампании: ${matchingCount} (требуется: ${task.minTxns})`);

      if (matchingCount >= task.minTxns) {
        return { success: true }
      }
      return { success: false }
    }

    if (task.endpoint) {
      let finalUrl = task.endpoint.replace('{$address}', userAddr);
      if (task.params)
        finalUrl = this.buildLinkUrl(task.endpoint, task.params, userAddr);

      const res = await fetch(finalUrl);
      if (!res.ok) return { success: false }
      const data = await res.json();
      if (task.expression) {
        const fn = new Function('data', `return (${task.expression})(data);`);
        return { success: !!fn(data) }
      }
      return { success: !!data.verified }
    }
    return { success: false }
  }

  private async handleOnchainCheckAmountOfTxns(
    quest: QuestType,
    userAddr: string
  ): Promise<{ success: boolean }> {
    if (quest.value.url) {
      return this.handleLinkQuest(quest, userAddr);
    }
    if (quest.value.methodToExecute) {
      try {
        const contractAddress =
          quest.value.contract ||
          (quest.value.contracts && quest.value.contracts[0]);
        if (!contractAddress) {
          this.logger.error('Контракт не задан в квесте');
          return { success: false }
        }
        const iface = new ethers.Interface([quest.value.methodToExecute]);
        const contract = new ethers.Contract(
          contractAddress,
          iface.fragments,
          soneiumProvider
        );
        const result = quest.value.methodToExecute.includes('balanceOf')
          ? await contract.balanceOf(userAddr)
          : await contract.checkDatas(userAddr);
        const streak = ethers.toBigInt(result) ? result : result.streak;
        this.logger.log(
          `checkDatas returned streak = ${streak.toString()} (требуется: ${quest.value.methodToEqual
          })`
        );
        if (streak < quest.value.methodToEqual) {
          return { success: false }
        }
        return { success: true }
      } catch (err) {
        console.error('Ошибка при вызове checkDatas:', err);
        return { success: false }
      }
    }

    const chain = quest.value.chain || 'Soneium';
    const c = await this.getCampaignById(quest.campaign_id);
    const txs = await this.getUserTransactions(chain, userAddr, c);

    if (quest.value.methodChecks && Array.isArray(quest.value.methodChecks)) {
      for (const checkItem of quest.value.methodChecks) {
        if (Array.isArray(checkItem)) {
          let groupCount = 0;
          const groupThreshold = checkItem[0].minTxns || 0;
          for (const check of checkItem) {
            try {
              const iface = new ethers.Interface([check.signature]);
              if (
                (iface.fragments[0] as ethers.FunctionFragment).name ===
                'externalDelegateCall'
              ) {
                const relevantTxs = txs.filter(
                  (tx) =>
                    check.contract &&
                    tx.to.toLowerCase() === check.contract.toLowerCase()
                );
                if (relevantTxs.length === 0) {
                  return { success: false }
                }
                const count = await relevantTxs.reduce(
                  async (prevPromise: Promise<number>, tx) => {
                    const acc = await prevPromise;
                    try {
                      let usdValue = 0;
                      if (+tx.value) {
                        const dataStr = tx.input.toLowerCase();
                        const tokenToCheck =
                          '570f09ac53b96929e3868f71864e36ff6b1b67d7';
                        if (dataStr.includes(tokenToCheck)) {
                          usdValue = await this.convertToUSD(
                            '0x4200000000000000000000000000000000000006',
                            tx.value
                          );
                          this.logger.debug('ETH стоимость (USD):', usdValue);
                        }
                      }
                      return usdValue >= check.txMinValue ? acc + 1 : acc;
                    } catch (err) {
                      return acc;
                    }
                  },
                  Promise.resolve(0)
                );
                groupCount += count;
              } else {
                const count = txs.reduce((acc, tx) => {
                  try {
                    if (
                      check.contract &&
                      tx.to.toLowerCase() !== check.contract.toLowerCase()
                    ) {
                      return acc;
                    }
                    const parsed = iface.parseTransaction({ data: tx.input });
                    return parsed &&
                      parsed.name ===
                      (iface.fragments[0] as ethers.FunctionFragment).name
                      ? acc + 1
                      : acc;
                  } catch (err) {
                    return acc;
                  }
                }, 0);
                groupCount += count;
              }
            } catch (err) {
              continue;
            }
          }
          this.logger.log(
            `Альтернативная группа: суммарно ${groupCount} транзакций (требуется: ${groupThreshold})`
          );
          if (groupCount < groupThreshold) {
            return { success: false }
          }
        } else {
          try {
            const iface = new ethers.Interface([checkItem.signature]);
            const count = txs.reduce((acc, tx) => {
              try {
                if (
                  checkItem.contract &&
                  tx.to.toLowerCase() !== checkItem.contract.toLowerCase()
                ) {
                  return acc;
                }
                const parsed = iface.parseTransaction({ data: tx.input });
                return parsed &&
                  parsed.name ===
                  (iface.fragments[0] as ethers.FunctionFragment).name
                  ? acc + 1
                  : acc;
              } catch (err) {
                return acc;
              }
            }, 0);
            this.logger.log(
              `Метод ${(iface.fragments[0] as ethers.FunctionFragment).name
              }: ${count} транзакций (требуется: ${checkItem.minTxns})`
            );
            if (count < checkItem.minTxns) {
              return { success: false }
            }
          } catch (err) {
            return { success: false }
          }
        }
      }
      return { success: true }
    } else {
      const minTxns = quest.value.minTxns || 0;
      const contractTxs = txs.filter((tx) =>
        quest.value.contracts.some(
          (addr: string) => tx.to.toLowerCase() === addr.toLowerCase()
        )
      );
      this.logger.log('Общее число транзакций по контрактам:', contractTxs.length);
      return { success: contractTxs.length >= minTxns }
    }
  }

  private async handleCheckOnchainMethodQuest(
    quest: QuestType,
    userAddr: string
  ): Promise<{ success: boolean }> {
    const abi = quest.value.actions
      ? quest.value.actions[0].methodSignatures
      : quest.value.methodSignatures;

    const iface = new ethers.Interface(abi);
    const c = await this.getCampaignById(quest.campaign_id);

    const transactions = await this.getUserTransactions(
      quest.value.chain,
      userAddr,
      c
    );

    const contractTransactions = transactions.filter(
      (tx) =>
        tx.to.toLowerCase() === quest.value.contracts[0]?.toLowerCase() ||
        tx.to.toLowerCase() === quest.value.contracts[1]?.toLowerCase() ||
        tx.to.toLowerCase() === quest.value.contracts[2]?.toLowerCase()
    );

    this.logger.log(`Transactions found for user ${contractTransactions.length}`);

    for (const tx of contractTransactions) {
      try {
        const parsed = iface.parseTransaction({ data: tx.input });

        if (parsed.name === 'checkIn') {
          return { success: true }
        }
        if (parsed.name === 'safeTransferFrom') {
          return { success: true }
        }

        if (quest.value.methodToFind) {
          for (let i = 0; i <= quest.value.methodToFind.length; i++) {
            if (parsed.name === quest.value.methodToFind[i]) {
              return { success: true }
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
                return { success: true }
              } else {
                this.logger.debug('❌ Квест не выполнен.');
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

    return { success: false }
  }

  private async handleCheckMethodQuest(quest: QuestType, userAddr: string): Promise<{ success: boolean }> {
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
      if (task.minAmountToken) {
        return { success: newBalance > task.minAmountToken }
      } else {
        return { success: newBalance > 0 }
      }
    } catch (e) {
      return { success: false }
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

  private async checkOnChainQuest(quest: QuestType, userAddr: string): Promise<{ success: boolean, tx_hash?: string }> {
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
      if (ok) return { success: true };
      return { success: false };
    }

    const chain = quest.value.chain || 'Soneium';

    const c = await this.getCampaignById(quest.campaign_id);

    const txs = await this.getUserTransactions(chain, userAddr, c);
    if (!txs.length) return { success: false };
    const txnsToAddress = txs.filter(
      (tx) =>
        tx.to.toLowerCase() === quest.value.contracts[0].toLowerCase() ||
        tx.to.toLowerCase() === quest.value.contracts[1]?.toLowerCase() ||
        tx.to.toLowerCase() === quest.value.contracts[2]?.toLowerCase()
    );

    for (const tx of txnsToAddress) {
      if (!data.minAmountUSD && !data.actions && data.methodSignatures) {
        const ok = await this.checkBuyNFTQuest(tx, data.methodSignatures);
        if (ok) return { success: true, tx_hash: tx.hash };
        return { success: false };
      }
      if (quest.value.type === 'checkInputData') {
        if (
          tx.input.startsWith('0xac9650d8') &&
          tx.input
            .toLowerCase()
            .includes('2CAE934a1e84F693fbb78CA5ED3B0A6893259441'.toLowerCase())
        ) {
          return {
            success: true,
            tx_hash: tx.hash
          }
        }
      }
      const ok = await this.parseOnchainTx(tx, data.actions);
      if (ok.success && ok.tx_hash) {
        return ok;
      }
    }

    return { success: false };
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
      this.logger.error('Ошибка parseTransaction:', err);
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
    const tokenCHex = '570f09AC53b96929e3868f71864E36Ff6b1B67D7';

    if (hexData.includes(tokenCHex)) {
      const idxA = data.indexOf(tokenAHex.toLowerCase());
      const idxB = data.indexOf(tokenBHex.toLowerCase());
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
      // tokenA: '0x' + tokenAHex,
      // tokenB: '0x' + tokenBHex,
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
        return {
          success: true,
          tx_hash: tx.hash
        }
      }
    }
    return false;
  }

  private async parseOnchainTx(tx: any, actions: any[]): Promise<{ success: boolean, tx_hash?: string }> {
    const rawInput = tx.input || '';
    if (!rawInput.startsWith('0x')) return { success: false };
    const x = await this.parseOnchainData(rawInput, actions, tx);
    return x
  }

  private async parseOnchainData(
    hexData: string,
    actions: any[],
    parentTx: any
  ): Promise<{ success: boolean, tx_hash?: string }> {
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
            if (ok.success) {
              subcallSuccess = true;
              break;
            }
          }

          if (subcallSuccess) {
            return {
              success: true,
              tx_hash: parentTx.hash
            }
          } else {
            continue;
          }
        }
        if (methodName === 'depositTokenDelegate') {
          const eventOk = await this.parseNeemoDepositEvent(parentTx.hash);
          if (eventOk) {
            return {
              success: true,
              tx_hash: parentTx.hash
            }
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
            return {
              success: false
            }
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
            return {
              success: true,
              tx_hash: parentTx.hash
            }
          }
        } else {
          const sumUSD1 = await this.checkActionTokens(
            action,
            parsedTx,
            parentTx
          );
          const sumUSD = methodName === 'mint' ? sumUSD1 * 2 : sumUSD1
          this.logger.debug(`Сумма USD: ${sumUSD} exp: ${sumUSD >= action.minUsdTotal}`);
          if (sumUSD >= (action.minUsdTotal || 0)) {
            this.logger.debug(`Квест выполнен: ${methodName === 'mint' ? sumUSD * 2 : sumUSD} >= ${action.minUsdTotal}`);
            return {
              success: true,
              tx_hash: parentTx.hash
            }
          } else {
            this.logger.debug(`Квест выполнен: false`);
            return {
              success: false,
              tx_hash: null
            }
          }
        }
      }
    }
    this.logger.debug(`Квест выполнен: false`);
    return {
      success: false,
      tx_hash: null
    }
  }

  private async parseNeemoDepositEvent(txHash: string): Promise<boolean> {
    const receipt = await soneiumProvider.getTransactionReceipt(txHash);
    if (!receipt || !receipt.logs) return false;

    const eventAbi = [
      'event LogDepositTokenDelegate(address indexed user, address indexed delegateTo, uint256 tokenAmount, uint256 lstAmount)',
    ];
    const iface = new ethers.Interface(eventAbi);

    for (const log of receipt.logs) {
      try {
        const parsedLog = iface.parseLog(log);
        if (parsedLog.name === 'LogDepositTokenDelegate') {
          return true;
        }
      } catch (e) {
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
        if (Array.isArray(parsedTx.args[0][tokenIdx])) {
          tokenVal = parsedTx.args[0][tokenIdx][1];
        }
        if (tokenDef.paramIndex && tokenDef.paramIndex2) {
          argVal = parsedTx.args[0][tokenDef.paramIndex2];
          actualTokens.push({ address: tokenDef.address, amount: argVal });
        } else {
          if (!tokenIdx) continue
          tokenVal = parsedTx.args[0][tokenIdx].includes(tokenDef.address)
            ? tokenDef.address
            : parsedTx.args[0][tokenIdx];
        }
      } else {
        try {
          argVal = parsedTx.args[idx];
          tokenVal = parsedTx.args[tokenIdx];
          if (Array.isArray(tokenVal)) {
            tokenVal = parsedTx.args[tokenIdx][0][1];
          }
        } catch (e) {
          this.logger.error(e);
        }
      }
      if (!tokenIdx && !tokenVal) {
        if (argVal) {
          actualTokens.push({ address: tokenDef.address, amount: argVal });
        }
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
      if (tokenVal && amountBN) {
        actualTokens.push({ address: tokenVal, amount: amountBN });
      }
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
          if (token1Index && (token0Index < token1Index)) {
            return 0;
          }
          const usdVal = await this.convertToUSD(
            action.tokens[i].address.toLowerCase(),
            actual.amount
          );
          return (totalUsd += usdVal);
        } else {
          if (!actual) totalUsd += 0;
          if (def.address.toLowerCase() !== actual.address.toLowerCase()) {
            totalUsd += 0;
          }
          if ((def.minAmountToken || 0) > 0) {
            totalUsd += 0;
          }
          const usdVal = await this.convertToUSD(actual.address, actual.amount);
          totalUsd += usdVal;
          return totalUsd
        }
      }
    } else {
      for (const def of action.tokens) {
        const found = actualTokens.find(
          (t) =>
            t.address && t.address.toLowerCase() === def.address.toLowerCase()
        );

        if (!found) {
          continue
        }
        if ((def.minAmountToken || 0) > 0) {
          // 466 same
        }
        if (actualTokens.length === 1) {
          return await this.convertToUSD(found.address, found.amount);
        } else {
          const usdVal = await this.convertToUSD(found.address, found.amount);
          totalUsd += usdVal;
        }
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
      tokenAddr.toLowerCase() ===
        '0xba9986d2381edf1da03b0b9c1f8b00dc4aacc369' ||
        tokenAddr.toLowerCase() ===
        '0x29219dd400f2Bf60E5a23d13Be72B486D4038894'.toLowerCase()
        ? 6
        : 18;
    const floatAmount = parseFloat(ethers.formatUnits(amountBN, decimals));
    if (
      tokenAddr.toLowerCase() ===
      '0xba9986d2381edf1da03b0b9c1f8b00dc4aacc369' ||
      tokenAddr.toLowerCase() ===
      '0x29219dd400f2Bf60E5a23d13Be72B486D4038894'.toLowerCase()
    ) {
      return floatAmount * 1;
    }
    const coingeckoKey =
      this.tokenToCoingeckoId[tokenAddr.toLowerCase()] || 'ethereum';
    const price = await this.priceService.getTokenPrice(coingeckoKey);
    if (!price) return 0;
    return floatAmount * price;
  }

  private async getUserTransactions(chain: any, addr: string, campaign: any) {
    if (chain === 'Soneium' || chain === 1868) {
      const now = Math.floor(Date.now() / 1000);
      const startedAt = Math.floor(campaign.started_at / 1000);
      const ignoreStart = campaign.ignore_campaign_start;
      let startTs = ignoreStart ? now - 14 * 24 * 60 * 60 : startedAt;
      if (startTs < 0) startTs = 0;
      const url = `https://soneium.blockscout.com/api?module=account&action=txlist&address=${addr}&start_timestamp=${startTs}&end_timestamp=${now}&page=0&offset=1000&sort=desc`;
      const r = await fetch(url);
      if (!r.ok) return [];
      const data = await r.json();
      if (!data || !Array.isArray(data.result)) return [];
      this.logger.log(`Txns length from bs ---> ${data.result.length}`);
      return data.result;
    }
    if (chain === 146) {
      const now = Math.floor(Date.now() / 1000);
      const startedAt = Math.floor(
        new Date(campaign.started_at + 'Z').getTime() / 1000
      );
      const ignoreStart = campaign.ignore_campaign_start;
      let startTs = ignoreStart ? now - 14 * 24 * 60 * 60 : startedAt;
      if (startTs < 0) startTs = 0;
      const apiKey = this.configService.get('ETHERSCAN_API_KEY') || '';
      const urlForBlock = `https://api.etherscan.io/v2/api?chainid=146&module=block&action=getblocknobytime&timestamp=${startTs}&closest=before&apikey=${apiKey}`;
      const rBlock = await fetch(urlForBlock);
      if (!rBlock.ok) return [];
      const dataBlock = await rBlock.json();
      if (!dataBlock.result) {
        throw new Error('No block hash by ts');
      }
      const block = dataBlock.result;
      const url = `https://api.etherscan.io/v2/api?chainid=146&module=account&action=txlist&address=${addr}&startblock=${block}&endblock=latest&page=1&offset=500&sort=desc&apikey=${apiKey}`
      // const url = `https://api.sonicscan.org/api?module=account&action=txlist&address=${addr}&startblock=${block}&endblock=latest&page=1&offset=500&sort=desc&apikey=${apiKey}`;
      const r = await fetch(url);
      if (!r.ok) return [];
      const data = await r.json();
      if (!data || !Array.isArray(data.result)) return [];
      this.logger.log(`Txns length from sonic ---> ${data.result.length}`);
      return data.result;
    }

    return [];
  }

  async getSignedMintData(idOrSlug: string, userAddress: string) {
    const campaign = await this.campaignService.getCampaignByIdOrSlug(idOrSlug);
    if (!campaign) {
      throw new BadRequestException('Campaign not found');
    }
    if (!campaign.pyramid_required) {
      throw new BadRequestException(
        'Campaign does not require minting Pyramid'
      );
    }

    const chainId = campaign.chain_id as CHAIN_ID | null
    if (!chainId) {
      throw new BadRequestException("Chain id not provided")
    }
    if (!SUPPORTED_CHAIN_IDS.includes(chainId)) {
      throw new BadRequestException("Not supported chainId")
    }

    const campaignStatus = await this.campaignService.getCampaignStatus(
      campaign.id,
      userAddress
    );
    if (campaignStatus.status === 'completed') {
      throw new BadRequestException('Campaign already completed');
    }

    const pyramidContractAddress = this.configService.getOrThrow(`PYRAMID_CONTRACT_ADDRESS_${chainId}`);

    const signDomain = {
      name: this.configService.getOrThrow('SIGN_DOMAIN_NAME'),
      version: this.configService.getOrThrow('SIGN_DOMAIN_VERSION'),
      chainId,
      verifyingContract: pyramidContractAddress
    };

    const completedQuests =
      await this.questRepository.getCompletedQuestsByUserInCampaign(
        campaign.id,
        userAddress
      );

    if (!completedQuests.length) {
      throw new BadRequestException(
        'No completed quests found for this campaign'
      );
    }

    if (completedQuests.length !== campaign.quests.length) {
      throw new BadRequestException('All quests must be completed');
    }

    const user = await this.userService.findByAddress(userAddress);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const transactions = completedQuests
      .filter((quest) => !!quest.transaction_hash)
      .map<ITransactionData>((quest) => {
        return {
          txHash: quest.transaction_hash,
          networkChainId: chainId,
        };
      });

    const txnsHashes = transactions.map((tx) => tx.txHash);

    const recipients: IFeeRecipient[] = user.ref_owner
      ? [
        {
          recipient: user.ref_owner, //ref_owner is the address of the user who referred the user
          BPS: REF_OWNER_BPS,
        },
      ]
      : [];

    const pyramidType =
      campaign.type === 'premium' ? PyramidType.GOLD : PyramidType.BASIC;

    const metadata = {
      name: campaign.name,
      image: PYRAMID_IMAGE_URI[pyramidType],
      attributes: [
        { trait_type: 'Quest ID', value: campaign.id },
        { trait_type: 'Type', value: campaign.type },
        { trait_type: 'Title', value: campaign.name },
        { trait_type: 'Transaction Chain', value: CHAIN_NAME[chainId] },
        { trait_type: 'Transaction Count', value: transactions.length },
        { trait_type: 'Transaction Hash' },
        { trait_type: 'Community', value: campaign.project_name },
        ...(campaign.tags
          ? [{ trait_type: 'Tags', value: campaign.tags.join(",") }]
          : []),
        { trait_type: 'Difficulty', value: campaign.difficulty },
      ],
    };

    const fileName = `${campaign.id
      }-${userAddress.toLowerCase()}-metadata.json`;
    const keyvalues = {
      campaignId: campaign.id,
      userAddress: userAddress.toLowerCase(),
    };

    const metadataURI = await this.ipfsService.uploadJson(
      metadata,
      fileName,
      keyvalues
    );

    // mint price depends on campaign type
    const mintPrice = MINT_PRICE[pyramidType][chainId];

    // reward amount is 0% of mint price, was 20% erlier
    let rewardAmount =
      (mintPrice * BigInt(USER_REWARD_BPS)) / BigInt(MAX_BPS);

    if (rewardAmount > BigInt(0)) {
      const hasMintedNfts = await this.hasMintedNfts(
        userAddress,
        Object.values(ARKADA_NFTS)
      );

      const highestNftMultiplierBPS = Object.values(ARKADA_NFTS).reduce(
        (acc, nft) => {
          // Only consider multiplier if NFT is minted
          if (hasMintedNfts[nft]) {
            return Math.max(acc, ARKADA_NFTS_MULTIPLIER_BPS[nft]);
          }
          return acc;
        },
        0
      );

      // reward amount is 20% of mint price + some BPS of base rewards depending on highest NFT multiplier
      rewardAmount =
        rewardAmount +
        (rewardAmount * BigInt(highestNftMultiplierBPS)) / BigInt(MAX_BPS);
    }

    const reward: IRewardData = {
      tokenAddress: ethers.ZeroAddress,
      chainId: parseInt(chainId),
      amount: rewardAmount.toString(),
      tokenId: 0,
      tokenType: 0,
      rakeBps: 0,
      factoryAddress: ethers.ZeroAddress,
    };

    const nonce = Date.now();

    const pyramidData: IMintPyramidData = {
      questId: campaign.id,
      nonce,
      price: mintPrice.toString(),
      toAddress: userAddress,
      walletProvider: 'metamask', // Default wallet provider
      tokenURI: metadataURI,
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

    return {
      data: pyramidData,
      signature,
    };
  }
}
