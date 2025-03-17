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

  async getCampaignStatus(id: string, address: string) {
    const client = this.dbService.getClient();
    try {
      const query = `
        SELECT 
          c.*,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM campaign_completions cc
              WHERE cc.campaign_id = c.id
              AND cc.user_address = $2
            ) THEN 'completed' ELSE 'incomplete' END AS status
        FROM campaigns c
        WHERE c.id = $1
        LIMIT 1;
      `;
      const result = await client.query(query, [id, address.toLowerCase()]);
      return result.rows[0];
    } catch (error) {
      throw new InternalServerErrorException(error.message);
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
    page: number,
    limit: number,
    type?: CampaignType,
    categoryDto?: string[]
  ): Promise<any[]> {
    const client = this.dbService.getClient();
    try {
      const offset = (page - 1) * limit;
      let query = `
        SELECT *
        FROM campaigns
        WHERE started_at <= NOW()
          AND finished_at >= NOW()
      `;
      const params: any[] = [];

      if (type) {
        params.push(type);
        query += ` AND type = $${params.length}`;
      }

      if (categoryDto !== undefined) {
        let slugs: string[] = [];
        if (categoryDto.length > 0) {
          if (
            typeof categoryDto[0] === 'string' &&
            categoryDto[0].trim().startsWith('[')
          ) {
            try {
              slugs = JSON.parse(categoryDto[0]);
            } catch (e) {
              slugs = [];
            }
          } else {
            slugs = categoryDto;
          }
        }
        if (slugs.length === 0) {
          query += ` AND category IS NOT NULL AND category <> '[]' `;
        } else {
          params.push(slugs);
          query += ` AND category::jsonb ?| $${params.length}::text[]`;
        }
      }

      params.push(limit);
      params.push(offset);
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
      Logger.error(`Error in findCampaignByIdOrSlug: ${error.message}`);
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
      const query = `
        SELECT
          q.campaign_id,
          COUNT(q.id)::int AS total_quest,
          COUNT(qc.quest_id)::int AS quest_completed,
          CASE WHEN EXISTS (
            SELECT 1 FROM campaign_completions cc
            WHERE cc.campaign_id = q.campaign_id
            AND cc.user_address = $1
          ) THEN 'completed' ELSE 'incomplete' END AS status
        FROM quests q
        LEFT JOIN quest_completions qc
          ON q.id = qc.quest_id
          AND qc.user_address = $1
        WHERE q.campaign_id IN (${idsList})
        GROUP BY q.campaign_id
      `;

      const res = await client.query(query, [userAddress.toLowerCase()]);

      const statsMap = new Map<
        string,
        { total_quest: number; quest_completed: number; status: string }
      >();
      for (const row of res.rows) {
        statsMap.set(row.campaign_id, {
          total_quest: row.total_quest,
          quest_completed: row.quest_completed,
          status: row.status,
        });
      }

      const results = campaignIds.map((cid) => {
        const data = statsMap.get(cid);
        if (!data) {
          return {
            campaignId: cid,
            total_quest: 0,
            quest_completed: 0,
            status: 'incomplete',
          };
        }
        return {
          campaignId: cid,
          total_quest: data.total_quest,
          quest_completed: data.quest_completed,
          status: data.status,
        };
      });

      return results;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  private addPaginationAndOrder(
    query: string,
    params: any[],
    limit: number,
    offset: number,
    orderBy: string
  ): { query: string; params: any[] } {
    query += ` ORDER BY ${orderBy}`;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    return { query, params };
  }

  private addTypeFilter(
    query: string,
    params: any[],
    type?: CampaignType,
    prefix = 'c.'
  ): { query: string; params: any[] } {
    if (type) {
      params.push(type);
      query += ` AND ${prefix}type = $${params.length}`;
    }
    return { query, params };
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
        let query = `
          SELECT 
            c.*,
            cc.completed_at,
            'completed' as user_status
          FROM campaigns c
          JOIN campaign_completions cc ON c.id = cc.campaign_id 
          WHERE cc.user_address = $1
        `;

        let params: any[] = [lowercaseAddress];

        ({ query, params } = this.addTypeFilter(query, params, type));
        ({ query, params } = this.addPaginationAndOrder(
          query,
          params,
          limit,
          offset,
          'cc.completed_at DESC'
        ));

        return (await client.query(query, params)).rows;
      }

      // Base query for active and started campaigns
      const baseQuery = `
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
                AND q.sequence <= t.max_seq
              ) THEN 'started'
              ELSE 'active'
            END as user_status
          FROM campaigns c
          LEFT JOIN campaign_completions cc ON c.id = cc.campaign_id AND cc.user_address = $1
          WHERE c.status = 'IN_PROGRESS'
            AND c.started_at <= NOW()
            AND c.finished_at >= NOW()
        )
        SELECT * FROM campaign_status WHERE user_status = $2`;

      const targetStatus =
        status === UserCampaignStatus.STARTED ? 'started' : 'active';
      let params: any[] = [lowercaseAddress, targetStatus];

      let query = baseQuery;
      ({ query, params } = this.addTypeFilter(query, params, type, ''));
      ({ query, params } = this.addPaginationAndOrder(
        query,
        params,
        limit,
        offset,
        'started_at DESC'
      ));

      return (await client.query(query, params)).rows;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
