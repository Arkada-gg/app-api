import { Injectable } from '@nestjs/common';
import { CampaignRepository } from './campaign.repository';
import { CampaignType } from './dto/get-campaigns.dto';
import { UserCampaignStatus } from './dto/get-user-campaigns.dto';

@Injectable()
export class CampaignService {
  constructor(private readonly campaignRepository: CampaignRepository) { }

  async getActiveCampaigns(
    page: number,
    limit: number,
    type?: CampaignType,
    category?: string[]
  ): Promise<any[]> {
    return this.campaignRepository.findActiveCampaigns(
      page,
      limit,
      type,
      category
    );
  }

  async getCampaignStats(startAt?: string, endAt?: string): Promise<any> {
    return this.campaignRepository.getCampaignStats(startAt, endAt);
  }

  async getCampaignByIdOrSlug(idOrSlug: string): Promise<any> {
    return this.campaignRepository.findCampaignByIdOrSlug(idOrSlug);
  }

  async getCampaignStatuses(ids: string[], address: string) {
    return this.campaignRepository.getCampaignStatuses(ids, address);
  }

  async incrementParticipants(id: string) {
    return this.campaignRepository.incrementParticipants(id);
  }

  async completeCampaignForUser(
    idOrSlug: string,
    address: string
  ): Promise<any> {
    return this.campaignRepository.completeCampaignForUser(idOrSlug, address);
  }

  async hasUserCompletedCampaign(
    idOrSlug: string,
    address: string
  ): Promise<any> {
    return this.campaignRepository.hasUserCompletedCampaign(idOrSlug, address);
  }

  async markCampaignAsCompleted(
    campaignId: string,
    userAddress: string
  ): Promise<boolean> {
    const result = await this.campaignRepository.markCampaignAsCompleted(
      campaignId,
      userAddress
    );
    return result.rowCount === 1;
  }

  async getCampaignStatus(campaignId: string, userAddress: string) {
    return this.campaignRepository.getCampaignStatus(campaignId, userAddress);
  }

  async getUserCampaigns(
    userAddress: string,
    status?: UserCampaignStatus,
    type?: CampaignType,
    page = 1,
    limit = 5
  ) {
    return this.campaignRepository.getUserCampaigns(
      userAddress,
      status,
      type,
      page,
      limit
    );
  }
}
