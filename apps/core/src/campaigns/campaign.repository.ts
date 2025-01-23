import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CampaignType } from './dto/get-campaigns.dto';

@Injectable()
export class CampaignRepository {
  constructor(private readonly dbService: DatabaseService) {}

  async findActiveCampaigns(
    type?: CampaignType,
    page = 1,
    limit = 10
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
      throw new InternalServerErrorException(error.message);
    }
  }

  async findCampaignByIdOrSlug(idOrSlug: string): Promise<any> {
    const client = this.dbService.getClient();
    try {
      const query = `
        SELECT * FROM campaigns
        WHERE id = $1 OR slug = $1
        LIMIT 1
      `;
      const result = await client.query(query, [idOrSlug]);
      return result.rows[0];
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
