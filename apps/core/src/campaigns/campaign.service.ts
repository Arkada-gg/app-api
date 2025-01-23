import { Injectable } from '@nestjs/common';
import { CampaignRepository } from './campaign.repository';
import { CampaignType } from './dto/get-campaigns.dto';

@Injectable()
export class CampaignService {
  constructor(private readonly campaignRepository: CampaignRepository) {}

  async getActiveCampaigns(
    page: number,
    limit: number,
    type?: CampaignType
  ): Promise<any[]> {
    return this.campaignRepository.findActiveCampaigns(page, limit, type);
  }

  async getCampaignByIdOrSlug(idOrSlug: string): Promise<any> {
    return this.campaignRepository.findCampaignByIdOrSlug(idOrSlug);
  }
}
