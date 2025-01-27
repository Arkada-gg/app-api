import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CampaignType } from './dto/get-campaigns.dto';

@Injectable()
export class CampaignRepository {
  constructor(private readonly dbService: DatabaseService) {}

  async findActiveCampaigns(
    page = 1,
    limit = 5,
    type?: CampaignType
  ): Promise<any[]> {
    const client = this.dbService.getClient();
    try {
      const offset = (page - 1) * limit;
      let query = `
        SELECT * FROM campaigns
        WHERE started_at <= NOW() AND finished_at >= NOW()
      `;
      const params: any[] = [];

      if (type) {
        params.push(type);
        query += ` AND type = $${params.length}`;
      }

      params.push(limit, offset);
      query += ` ORDER BY started_at DESC LIMIT $${params.length - 1} OFFSET $${
        params.length
      }`;

      const result = await client.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error in findActiveCampaigns:', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  async findCampaignByIdOrSlug(idOrSlug: string): Promise<any> {
    const client = this.dbService.getClient();
    try {
      const query = `
          SELECT * FROM campaigns
          WHERE id = $1
          LIMIT 1;
        `;
      const result = await client.query(query, [idOrSlug]);
      if (result.rows.length === 0) {
        throw new NotFoundException('Campaign not found');
      }
      return result.rows[0];
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async completeCampaignForUser(
    idOrSlug: string,
    address: string
  ): Promise<void> {
    const client = this.dbService.getClient();
    const addressBytes = Buffer.from(address.toLowerCase());

    try {
      await client.query('BEGIN');

      const campaignQuery = `
          SELECT id FROM campaigns
          WHERE id = $1
          LIMIT 1;
        `;

      const campaignParams = [idOrSlug];
      const campaignResult = await client.query(campaignQuery, campaignParams);

      if (campaignResult.rows.length === 0) {
        throw new NotFoundException('Campaign not found');
      }

      const campaignId = campaignResult.rows[0].id;

      const checkQuery = `
        SELECT 1 FROM campaign_completions
        WHERE campaign_id = $1 AND user_address = $2
        LIMIT 1;
      `;
      const checkResult = await client.query(checkQuery, [
        campaignId,
        addressBytes,
      ]);

      if (checkResult.rows.length > 0) {
        throw new BadRequestException('Campaign already completed by the user');
      }

      const insertQuery = `
        INSERT INTO campaign_completions (campaign_id, user_address)
        VALUES ($1, $2);
      `;
      await client.query(insertQuery, [campaignId, addressBytes]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  async hasUserCompletedCampaign(
    idOrSlug: string,
    address: string
  ): Promise<boolean> {
    const client = this.dbService.getClient();
    const addressBytes = Buffer.from(address.toLowerCase());

    try {
      const campaignQuery = `
          SELECT id FROM campaigns
          WHERE id = $1
          LIMIT 1;
        `;

      const campaignParams = [idOrSlug];
      const campaignResult = await client.query(campaignQuery, campaignParams);

      if (campaignResult.rows.length === 0) {
        throw new NotFoundException('Campaign not found');
      }

      const campaignId = campaignResult.rows[0].id;

      const checkQuery = `
        SELECT 1 FROM campaign_completions
        WHERE campaign_id = $1 AND user_address = $2
        LIMIT 1;
      `;
      const checkResult = await client.query(checkQuery, [
        campaignId,
        addressBytes,
      ]);

      return checkResult.rows.length > 0;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }
}
