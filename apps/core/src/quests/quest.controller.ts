import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Get,
  Param,
  InternalServerErrorException,
  ParseUUIDPipe,
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
    const isCompleted = await this.questService.checkQuest(id, address);
    if (!isCompleted) {
      throw new BadRequestException('Quest not completed');
    } else {
      await this.questService.completeQuestAndAwardPoints(id, address);
    }
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

  @Get('completions/campaign/:campaignId/user/:userAddress')
  @ApiOperation({
    summary: 'Получить все выполненные квесты пользователя внутри кампании',
  })
  @ApiParam({
    name: 'campaignId',
    type: 'string',
    description: 'UUID идентификатор кампании',
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
    @Param('campaignId', new ParseUUIDPipe()) campaignId: string,
    @Param('userAddress') userAddress: string
  ): Promise<QuestCompletionDto[]> {
    try {
      const user = await this.userService.findByAddress(userAddress);
      if (!user) {
        throw new InternalServerErrorException('Пользователь не найден');
      }

      const completions =
        await this.questService.getCompletedQuestsByUserInCampaign(
          userAddress,
          campaignId
        );
      return completions;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
