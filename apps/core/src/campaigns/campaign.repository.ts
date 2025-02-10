import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CampaignType } from './dto/get-campaigns.dto';

@Injectable()
export class CampaignRepository {
  constructor(private readonly dbService: DatabaseService) {}

  private isUUID(str: string): boolean {
    const regex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return regex.test(str);
  }

  async incrementParticipants(campaignId: string): Promise<void> {
    const client = this.dbService.getClient();
    try {
      const updateQuery = `
        UPDATE campaigns 
        SET participants = participants + 1 
        WHERE id = $1
      `;
      await client.query(updateQuery, [campaignId]);
      Logger.debug(`Participants incremented for campaign ${campaignId}`);
    } catch (error) {
      throw new InternalServerErrorException(
        `Error incrementing participants: ${error.message}`
      );
    }
  }

  async markCampaignAsCompleted(
    campaignId: string,
    userAddress: string
  ): Promise<{ rowCount: number }> {
    const lowerAddress = userAddress.toLowerCase();
    try {
      const query = `
        INSERT INTO campaign_completions (campaign_id, user_address, completed_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (campaign_id, user_address) DO NOTHING
      `;
      const result = await this.dbService
        .getClient()
        .query(query, [campaignId, lowerAddress]);
      return { rowCount: result.rowCount };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

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
      let query = '';

      if (this.isUUID(idOrSlug)) {
        query = `
          SELECT 
            c.*, 
            COALESCE(json_agg(q) FILTER (WHERE q.id IS NOT NULL), '[]') AS quests
          FROM 
            campaigns c
          LEFT JOIN 
            quests q ON c.id = q.campaign_id
          WHERE 
            c.id = $1
          GROUP BY 
            c.id;
        `;
      } else {
        query = `
          SELECT 
            c.*, 
            COALESCE(json_agg(q) FILTER (WHERE q.id IS NOT NULL), '[]') AS quests
          FROM 
            campaigns c
          LEFT JOIN 
            quests q ON c.id = q.campaign_id
          WHERE 
            c.slug = $1
          GROUP BY 
            c.id;
        `;
      }

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
    const lowerAddress = address.toLowerCase();
    const client = this.dbService.getClient();

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
        lowerAddress,
      ]);

      if (checkResult.rows.length > 0) {
        throw new BadRequestException('Campaign already completed by the user');
      }

      const insertQuery = `
        INSERT INTO campaign_completions (campaign_id, user_address)
        VALUES ($1, $2);
      `;
      await client.query(insertQuery, [campaignId, lowerAddress]);

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
    const lowerAddress = address.toLowerCase();
    const client = this.dbService.getClient();

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
        lowerAddress,
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
