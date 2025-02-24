import {
  Controller,
  Get,
  Query,
  Param,
  BadRequestException,
  Post,
  Body,
} from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { GetCampaignsDto, CampaignType } from './dto/get-campaigns.dto';
import { GetCampaignDto } from './dto/get-campaign.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiQuery,
} from '@nestjs/swagger';
import {
  GetCampaignByIdOrSlugResponse,
  GetCampaignResponse,
} from '../shared/interfaces';
import { CampaignStatusDto } from './dto/campaign-status.dto';

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
