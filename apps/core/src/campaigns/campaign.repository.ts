import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CampaignType } from './dto/get-campaigns.dto';
import { UserCampaignStatus } from './dto/get-user-campaigns.dto';

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
        WHERE started_at <= NOW()
          AND finished_at >= NOW()
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

  async getCampaignStatuses(campaignIds: string[], userAddress: string) {
    const client = this.dbService.getClient();
    const idsList = campaignIds.map((id) => `'${id}'`).join(',');

    try {
      const completedQuery = `
        SELECT campaign_id 
        FROM campaign_completions
        WHERE user_address = $1
          AND campaign_id IN (${idsList})
      `;

      const startedQuery = `
SELECT DISTINCT q.campaign_id
FROM quests q
JOIN quest_completions qc ON q.id = qc.quest_id
JOIN (
  SELECT campaign_id, MAX(sequence) AS max_seq
  FROM quests
  GROUP BY campaign_id
) t ON q.campaign_id = t.campaign_id
WHERE qc.user_address = $1
  AND q.sequence < t.max_seq
  AND q.campaign_id IN (${idsList})
      `;

      const [completedRes, startedRes] = await Promise.all([
        client.query(completedQuery, [userAddress.toLowerCase()]),
        client.query(startedQuery, [userAddress.toLowerCase()]),
      ]);

      const completedSet = new Set<string>(
        completedRes.rows.map((row) => row.campaign_id)
      );
      const startedSet = new Set<string>(
        startedRes.rows.map((row) => row.campaign_id)
      );

      const results: {
        campaignId: string;
        status: 'completed' | 'started' | 'not_started';
      }[] = [];

      for (const cid of campaignIds) {
        if (completedSet.has(cid)) {
          results.push({ campaignId: cid, status: 'completed' });
        } else if (startedSet.has(cid)) {
          results.push({ campaignId: cid, status: 'started' });
        } else {
          results.push({ campaignId: cid, status: 'not_started' });
        }
      }

      return results;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async getUserCampaigns(
    userAddress: string,
    status?: UserCampaignStatus,
    type?: CampaignType,
    page = 1,
    limit = 5
  ) {
    const client = this.dbService.getClient();
    const lowercaseAddress = userAddress.toLowerCase();
    const offset = (page - 1) * limit;

    try {
      // Handle completed campaigns separately for better ordering by completed_at
      if (status === UserCampaignStatus.COMPLETED) {
        let completedQuery = `
          SELECT 
            c.*,
            cc.completed_at,
            'completed' as user_status
          FROM campaigns c
          JOIN campaign_completions cc ON c.id = cc.campaign_id 
          WHERE cc.user_address = $1
        `;

        const params: any[] = [lowercaseAddress];

        if (type) {
          params.push(type);
          completedQuery += ` AND c.type = $${params.length}`;
        }

        completedQuery += ` ORDER BY cc.completed_at DESC`;
        completedQuery += ` LIMIT $${params.length + 1} OFFSET $${
          params.length + 2
        }`;
        params.push(limit, offset);

        return (await client.query(completedQuery, params)).rows;
      }

      // Handle active and started campaigns
      let query = `
        WITH campaign_status AS (
          SELECT 
            c.*,
            CASE 
              WHEN cc.user_address IS NOT NULL THEN 'completed'
              WHEN EXISTS (
                SELECT 1 
                FROM quests q
                JOIN quest_completions qc ON q.id = qc.quest_id
                JOIN (
                  SELECT campaign_id, MAX(sequence) AS max_seq
                  FROM quests
                  GROUP BY campaign_id
                ) t ON q.campaign_id = t.campaign_id
                WHERE q.campaign_id = c.id 
                AND qc.user_address = $1
                AND q.sequence < t.max_seq
              ) THEN 'started'
              ELSE 'active'
            END as user_status
          FROM campaigns c
          LEFT JOIN campaign_completions cc ON c.id = cc.campaign_id AND cc.user_address = $1
          WHERE c.status = 'IN_PROGRESS'
            AND c.started_at <= NOW()
            AND c.finished_at >= NOW()
        )`;

      const params: any[] = [lowercaseAddress];

      let whereClause = '';

      if (status === UserCampaignStatus.STARTED) {
        whereClause = ` WHERE user_status = 'started'`;
      } else {
        whereClause = ` WHERE user_status = 'active'`;
      }

      if (type) {
        params.push(type);
        whereClause += ` AND type = $${params.length}`;
      }

      query += ` SELECT * FROM campaign_status${whereClause}`;
      query += ` ORDER BY started_at DESC`;
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      return (await client.query(query, params)).rows;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
