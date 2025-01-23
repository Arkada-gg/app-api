import {
  Controller,
  Get,
  Query,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { GetCampaignsDto, CampaignType } from './dto/get-campaigns.dto';
import { GetCampaignDto } from './dto/get-campaign.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';

@ApiTags('Campaigns')
@Controller('campaigns')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Get()
  @ApiOperation({
    summary: 'Получить активные кампании с фильтрацией по типу и пагинацией',
  })
  @ApiResponse({ status: 200, description: 'Список кампаний' })
  @ApiBadRequestResponse({ description: 'Некорректные параметры запроса' })
  async getCampaigns(@Query() query: GetCampaignsDto) {
    const { type, page = 1, limit = 5 } = query;
    return this.campaignService.getActiveCampaigns(page, limit, type);
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Получить кампанию по ID или Slug' })
  @ApiResponse({ status: 200, description: 'Детали кампании' })
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
