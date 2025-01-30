import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Get,
  Param,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { QuestService } from './quest.service';
import { CheckQuestDto } from './dto/check-quest.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ethers } from 'ethers';
import { QuestCompletionDto } from './dto/quest.competion.dto';
import { UserService } from '../user/user.service';
import { CompleteQuestDto } from './dto/complete-quest.dto';
import { WildcardCorsInterceptor } from './interceptors/wildcard-cors.interceptor';

@ApiTags('Quests')
@Controller('quests')
export class QuestController {
  constructor(
    private readonly questService: QuestService,
    private readonly userService: UserService
  ) {}

  @Post('check-quest')
  @ApiOperation({ summary: 'Проверить выполнение задания пользователем' })
  @ApiResponse({ status: 200, description: 'Задание выполнено' })
  @ApiBadRequestResponse({
    description: 'Задание не выполнено или некорректные данные',
  })
  async checkQuest(@Body() checkQuestDto: CheckQuestDto) {
    const { id, address } = checkQuestDto;
    if (!ethers.isAddress(address)) {
      throw new BadRequestException('Incorrect address');
    }
    const quest = await this.questService.getQuest(id);
    if (!quest) {
      throw new BadRequestException(`No quest with id ${id}`);
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
  @ApiOperation({ summary: 'Выполнить квест QUIZ' })
  @ApiResponse({ status: 200, description: 'Задание выполнено' })
  @ApiBadRequestResponse({
    description: 'Задание не выполнено или некорректные данные',
  })
  async completeQuest(@Body() completeQuestDto: CompleteQuestDto) {
    const { id, address, signature } = completeQuestDto;
    if (!ethers.isAddress(address)) {
      throw new BadRequestException('Incorrect address');
    }
    const rawMessage = process.env.VERIFICATION_MESSAGE || '';

    let message = rawMessage.trim();
    if (message.startsWith('"') && message.endsWith('"')) {
      message = message.slice(1, -1);
    }
    message = message.replace(/\\n/g, '\n');

    try {
      const messageHash = ethers.hashMessage(message);
      const recovered = ethers.recoverAddress(messageHash, signature);
      if (recovered.toLowerCase() !== address.toLowerCase()) {
        throw new BadRequestException('Invalid signature');
      }
    } catch (error) {
      console.error('Signature verification error:', error);
      throw new BadRequestException('Invalid signature or verification failed');
    }

    const quest = await this.questService.getQuest(id);
    if (!quest) {
      throw new BadRequestException(`No quest with id ${id}`);
    }
    if (quest.type !== 'quiz') {
      throw new BadRequestException('Cant complete qust if it is not Quiz');
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

  @Get('hasMinted/:address')
  @UseInterceptors(WildcardCorsInterceptor)
  @ApiOperation({
    summary: 'Check if the user has minted the NFT',
    description:
      'Returns `1` if the user at :address has minted at least one NFT on a specific contract; otherwise returns `0`.',
  })
  @ApiParam({
    name: 'address',
    description: 'The user’s wallet address to check',
    required: true,
    example: '0x1234abcd...',
  })
  @ApiResponse({
    status: 200,
    description: '1 if minted, 0 if not minted',
    type: Number,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async checkHasMinted(@Param('address') address: string): Promise<number> {
    try {
      const hasMinted = await this.questService.hasMintedNft(address);
      return hasMinted ? 1 : 0;
    } catch (error) {
      throw new HttpException(
        `Error checking minted NFT: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
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
}
