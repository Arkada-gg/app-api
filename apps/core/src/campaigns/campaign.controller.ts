import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  GetCampaignByIdOrSlugResponse,
  GetCampaignResponse,
  GetCampaignWithUserStatusResponse,
} from '../shared/interfaces';
import { CampaignService } from './campaign.service';
import { CampaignStatusDto } from './dto/campaign-status.dto';
import { GetCampaignDto } from './dto/get-campaign.dto';
import { GetCampaignsDto } from './dto/get-campaigns.dto';
import { GetUserCampaignsDto } from './dto/get-user-campaigns.dto';

@ApiTags('Campaigns')
@Controller('campaigns')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Get()
  @ApiOperation({
    summary: 'Получить активные кампании с фильтрацией по типу и пагинацией',
  })
  @ApiResponse({
    status: 200,
    description: 'Список кампаний',
    type: [GetCampaignResponse],
  })
  @ApiBadRequestResponse({ description: 'Некорректные параметры запроса' })
  async getCampaigns(@Query() query: GetCampaignsDto) {
    const { type, page = 1, limit = 5 } = query;
    return this.campaignService.getActiveCampaigns(page, limit, type);
  }

  @Get('status')
  @ApiOperation({ summary: 'Получить статус кампаний по userAddress (GET)' })
  @ApiQuery({
    name: 'campaignIds',
    required: true,
    description: 'Список ID кампаний, через запятую',
    example: '123e4567-e89b-12d3-a456-426614174001,abc123',
  })
  @ApiQuery({
    name: 'userAddress',
    required: true,
    description: 'Адрес пользователя',
    example: '0xUserAddressHere',
  })
  @ApiResponse({
    status: 200,
    description: 'Возвращает статусы для каждой кампании',
    type: CampaignStatusDto,
    isArray: true,
  })
  @ApiBadRequestResponse({ description: 'Некорректные параметры запроса' })
  async getCampaignStatusesViaGet(
    @Query('campaignIds') campaignIdsStr: string,
    @Query('userAddress') userAddress: string
  ) {
    if (!campaignIdsStr) {
      throw new BadRequestException('No campaignIds provided');
    }
    if (!userAddress) {
      throw new BadRequestException('No userAddress provided');
    }

    const campaignIds = campaignIdsStr.split(',').map((s) => s.trim());

    return this.campaignService.getCampaignStatuses(campaignIds, userAddress);
  }

  @Get('user')
  @ApiOperation({
    summary: 'Получить кампании пользователя с фильтрацией по статусу',
    description: `
      Возвращает список кампаний для пользователя в зависимости от статуса:
      - active: активные кампании, в которых пользователь еще не участвовал
      - started: активные кампании, которые пользователь начал, но не завершил
      - completed: кампании, которые пользователь завершил
      Если статус не указан, возвращаются все активные кампании

      Поддерживает пагинацию и фильтрацию по типу кампании
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Список кампаний пользователя',
    type: [GetCampaignWithUserStatusResponse],
  })
  @ApiBadRequestResponse({ description: 'Некорректные параметры запроса' })
  async getUserCampaigns(@Query() query: GetUserCampaignsDto) {
    const { userAddress, status, type, page = 1, limit = 5 } = query;
    return this.campaignService.getUserCampaigns(
      userAddress,
      status,
      type,
      page,
      limit
    );
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Получить кампанию по ID или Slug' })
  @ApiResponse({
    status: 200,
    description: 'Детальная информация о кампании',
    type: GetCampaignByIdOrSlugResponse,
  })
  @ApiBadRequestResponse({ description: 'Кампания не найдена' })
  async getCampaign(@Param() params: GetCampaignDto) {
    const { idOrSlug } = params;
    const campaign = await this.campaignService.getCampaignByIdOrSlug(idOrSlug);
    if (!campaign) {
      throw new BadRequestException('Campaign not found');
    }
    return campaign;
  }
}
