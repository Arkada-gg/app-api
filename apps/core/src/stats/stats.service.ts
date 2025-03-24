import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { CampaignService } from '../campaigns/campaign.service';

@Injectable()
export class StatsService {
  constructor(private readonly userService: UserService, private readonly campaignService: CampaignService) { }

  async getPointsHistory(page: number, limit: number, address?: string): Promise<any> {
    try {
      return await this.userService.getUserPointsHistory(page, limit, address);
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async getCampaignStats(startAt?: string, endAt?: string): Promise<any> {
    try {
      return await this.campaignService.getCampaignStats(startAt, endAt);
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
