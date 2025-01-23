import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { QuestService } from './quest.service';
import { CheckQuestDto } from './dto/check-quest.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';

@ApiTags('Quests')
@Controller('quests')
export class QuestController {
  constructor(private readonly questService: QuestService) {}

  @Post('check-quest')
  @ApiOperation({ summary: 'Проверить выполнение задания пользователем' })
  @ApiResponse({ status: 200, description: 'Задание выполнено' })
  @ApiBadRequestResponse({
    description: 'Задание не выполнено или некорректные данные',
  })
  async checkQuest(@Body() checkQuestDto: CheckQuestDto) {
    const { id, address } = checkQuestDto;
    const isCompleted = await this.questService.checkQuest(id, address);
    if (!isCompleted) {
      throw new BadRequestException('Quest not completed');
    }
    return { message: 'Quest completed' };
  }
}
