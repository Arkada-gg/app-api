import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConditionalSignatureAuthGuard } from '../auth/guard/conditional-auth.guard';
import { UserService } from '../user/user.service';
import { CheckQuestDto } from './dto/check-quest.dto';
import { CompleteQuestDto } from './dto/complete-quest.dto';
import { GetMintDataDto } from './dto/get-mint-data.dto';
import { QuestCompletionDto } from './dto/quest.competion.dto';
import { QuestService } from './quest.service';

@ApiTags('Quests')
@Controller('quests')
export class QuestController {
  constructor(
    private readonly questService: QuestService,
    private readonly userService: UserService
  ) {}

  @Post('check-quest')
  @UseGuards(ConditionalSignatureAuthGuard)
  @ApiOperation({ summary: 'Проверить выполнение задания пользователем' })
  @ApiResponse({ status: 200, description: 'Задание выполнено' })
  @ApiBadRequestResponse({
    description: 'Задание не выполнено или некорректные данные',
  })
  async checkQuest(@Body() checkQuestDto: CheckQuestDto) {
    const { id, address } = checkQuestDto;

    const quest = await this.questService.getQuest(id);
    if (!quest) {
      throw new BadRequestException(`No quest with id ${id}`);
    }
    const campaignId = quest.campaign_id;
    const campaign = await this.questService.getCampaignById(campaignId);
    if (campaign.status === 'FINISHED' || campaign.finishedAt <= Date.now()) {
      throw new BadRequestException(
        'This campaign is finished; cannot proceed.'
      );
    }
    if (quest.type === 'quiz') {
      const isCompleted = await this.questService.checkQuestCompletion(
        id,
        address
      );
      if (!isCompleted) {
        throw new BadRequestException('Quest not completed');
      } else {
        await this.questService.completeQuestAndAwardPoints(id, address);
      }
      return { id, address, isCompleted };
    }
    const isCompleted = await this.questService.checkQuest(id, address);
    if (!isCompleted) {
      throw new BadRequestException('Quest not completed');
    } else {
      await this.questService.completeQuestAndAwardPoints(id, address);
    }
    return { id, address, isCompleted };
  }

  @Post('complete-quest')
  @UseGuards(ConditionalSignatureAuthGuard)
  @ApiOperation({ summary: 'Выполнить квест NOT ONCHAIN' })
  @ApiResponse({ status: 200, description: 'Задание выполнено' })
  @ApiBadRequestResponse({
    description: 'Задание не выполнено или некорректные данные',
  })
  async completeQuest(@Body() completeQuestDto: CompleteQuestDto) {
    const { id, address } = completeQuestDto;

    const quest = await this.questService.getQuest(id);
    if (!quest) {
      throw new BadRequestException(`No quest with id ${id}`);
    }
    const campaignId = quest.campaign_id;
    const campaign = await this.questService.getCampaignById(campaignId);
    if (campaign.status === 'FINISHED' || campaign.finishedAt <= Date.now()) {
      throw new BadRequestException(
        'This campaign is finished; cannot proceed.'
      );
    }

    if (quest.type === 'onchain') {
      throw new BadRequestException('Cant complete qust if it is Onchain');
    }

    const questIsCompleted = await this.questService.checkQuestCompletion(
      id,
      address
    );

    if (questIsCompleted) {
      throw new BadRequestException('Quest already completed');
    }

    const isCompleted = await this.questService.completeQuestQuiz(id, address);

    return { id, address, isCompleted };
  }

  @Get('completions/user/:userAddress')
  @ApiOperation({ summary: 'Получить все выполненные квесты пользователя' })
  @ApiParam({
    name: 'userAddress',
    type: 'string',
    description:
      'Адрес пользователя в блокчейне (например, "0x0141a079703d3c4b8f89a0268c1e4901492f14c2")',
  })
  @ApiResponse({
    status: 200,
    description: 'Список выполненных квестов пользователя',
    type: [QuestCompletionDto],
  })
  async getAllCompletedQuestsByUser(
    @Param('userAddress') userAddress: string
  ): Promise<QuestCompletionDto[]> {
    try {
      const user = await this.userService.findByAddress(userAddress);
      if (!user) {
        throw new BadRequestException('Пользователь не найден');
      }
      const completions = await this.questService.getAllCompletedQuestsByUser(
        userAddress
      );
      return completions;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  @Get('completions/campaign/:campaignIdOrSlug/user/:userAddress')
  @ApiOperation({
    summary: 'Получить все выполненные квесты пользователя внутри кампании',
  })
  @ApiParam({
    name: 'campaignIdOrSlug',
    type: 'string',
    description: 'UUID идентификатор кампании или slug',
  })
  @ApiParam({
    name: 'userAddress',
    type: 'string',
    description:
      'Адрес пользователя в блокчейне (например, "0x0141a079703d3c4b8f89a0268c1e4901492f14c2")',
  })
  @ApiResponse({
    status: 200,
    description: 'Список выполненных квестов пользователя внутри кампании',
    type: [QuestCompletionDto],
  })
  async getCompletedQuestsByUserInCampaign(
    @Param('campaignIdOrSlug') campaignIdOrSlug: string,
    @Param('userAddress') userAddress: string
  ): Promise<QuestCompletionDto[]> {
    try {
      if (!userAddress.startsWith('0x') || userAddress.length !== 42) {
        throw new BadRequestException('Invalid address format');
      }
      const user = await this.userService.findByAddress(userAddress);
      if (!user) {
        throw new InternalServerErrorException('Пользователь не найден');
      }

      return await this.questService.getCompletedQuestsByUserInCampaign(
        campaignIdOrSlug,
        userAddress
      );
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  @Get('mint-data')
  @ApiOperation({
    summary: 'Получить подписанные данные для минта пирамиды',
  })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Детальная информация о кампании',
  //   type: GetCampaignByIdOrSlugResponse,
  // })
  @ApiBadRequestResponse({ description: 'Кампания не найдена' })
  async getSignedMintData(@Query() query: GetMintDataDto) {
    const { campaignIdOrSlug, userAddress } = query;
    const campaign = await this.questService.getSignedMintData(
      campaignIdOrSlug,
      userAddress
    );
    return campaign;
  }
}
