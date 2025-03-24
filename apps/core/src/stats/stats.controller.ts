import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { ArkadaGuard } from '../auth/guard/arkada-auth.guard';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { CampaignStatsDto } from './dto/campaign-stats.dto';
import { PointsStatsDto } from './dto/points-stats.dto';

@ApiTags('Stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) { }

  @Get('points-history')
  @ApiOperation({ summary: 'Возвращает историю начислений поинтов с пагинацией. Если передан address, возвращаются только записи указанного пользователя.' })
  @ApiQuery({ name: 'page', required: false, description: 'Номер страницы для пагинации', type: String, example: '1' })
  @ApiQuery({ name: 'limit', required: false, description: 'Количество записей на страницу', type: String, example: '20' })
  @ApiQuery({ name: 'address', required: false, description: 'Адрес пользователя для фильтрации записей' })
  @ApiResponse({
    status: 200,
    description: 'История изменения баланса',
    type: [PointsStatsDto],
  })
  async getPointsHistory(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('address') address?: string
  ) {
    return await this.statsService.getPointsHistory(Number(page), Number(limit), address);
  }

  @Get('campaigns')
  @UseGuards(ArkadaGuard)
  @ApiOperation({ summary: 'Возвращает статистику по кампаниям с фильтрами по датам' })
  @ApiQuery({ name: 'startAt', required: false, description: 'Начальная дата для фильтрации выполнения кампаний', example: '2025-03-01' })
  @ApiQuery({ name: 'endAt', required: false, description: 'Конечная дата для фильтрации выполнения кампаний', example: '2025-03-31' })
  @ApiResponse({
    status: 200,
    description: 'Статистика по кампаниям',
    type: CampaignStatsDto,
  })
  async getCampaignStats(
    @Query('startAt') startAt?: string,
    @Query('endAt') endAt?: string,
  ) {
    return await this.statsService.getCampaignStats(startAt, endAt);
  }
}
