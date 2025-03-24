import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { QuestRepository } from '../quests/quest.repository';
import { IUser, PyramidType } from '../shared/interfaces';
import { UpdateUserDto } from './dto/update-user.dto';
import { PoolClient } from 'pg';

@Injectable()
export class UserRepository {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly questRepository: QuestRepository
  ) { }

  async createEmail(email: string, address?: string) {
    const lowerAddress = address ? address.toLowerCase() : null;
    const lower = email.toLowerCase();
    const query = `
      INSERT INTO user_email (email, address)
      VALUES ($1, $2)
      RETURNING email, address, created_at, updated_at
    `;
    const values = [lower, lowerAddress || null];
    const result = await this.dbService.query(query, values);
    return result.rows[0];
  }

  async findEmail(email: string) {
    const lower = email.toLowerCase();
    try {
      const res = await this.dbService.query<IUser>(
        `SELECT * FROM user_email WHERE email = $1`,
        [lower]
      );
      return res.rows[0] || null;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async findAddress(address: string) {
    const lower = address.toLowerCase();
    try {
      const res = await this.dbService.query<IUser>(
        `SELECT * FROM user_email WHERE address = $1`,
        [lower]
      );
      return res.rows[0] || null;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async findByAddress(address: string): Promise<IUser | null> {
    const lower = address.toLowerCase();

    try {
      const userResult = await this.dbService.query<IUser>(
        `SELECT *, COALESCE(points, 0) AS total_points, last_wallet_score_update FROM users WHERE address = $1`,
        [lower]
      );

      if (!userResult.rows[0]) {
        return null;
      }

      const user = userResult.rows[0];
      user.address = user.address.toString();

      const pointsResult = await this.dbService.query<{
        point_type: string;
        sum: number;
      }>(
        `
        SELECT point_type, COALESCE(SUM(points), 0) AS sum
        FROM user_points
        WHERE user_address = $1
        GROUP BY point_type
        `,
        [lower]
      );

      let refPoints = 0;
      let baseCampaignPoints = 0;
      let dailyPoints = 0;

      for (const row of pointsResult.rows) {
        if (row.point_type === 'referral') {
          refPoints = +row.sum;
        } else if (row.point_type === 'base_campaign') {
          baseCampaignPoints = row.sum;
        } else if (row.point_type === 'daily') {
          dailyPoints = row.sum;
        }
      }

      user.points = {
        ref: +refPoints,
        daily: +dailyPoints,
        twitter: user.twitter_points,
        base_campaign: +baseCampaignPoints,
        wallet: user.wallet_points || 0,
        wallet_additional: user.wallet_additional_points || 0,
        total: +user.total_points,
      };

      delete user.total_points;

      return user;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async findByEmail(email: string): Promise<IUser | null> {
    const lower = email.toLowerCase();
    try {
      const res = await this.dbService.query<IUser>(
        `SELECT * FROM users WHERE email = $1`,
        [lower]
      );
      return res.rows[0] || null;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async findUsersWithTwitterChunk(
    offset: number,
    limit: number
  ): Promise<any[]> {
    try {
      const query = `
        SELECT address AS id, twitter AS twitterHandle
        FROM users
        WHERE twitter IS NOT NULL
        ORDER BY address
        LIMIT $1 OFFSET $2
      `;
      const result = await this.dbService.query(query, [limit, offset]);
      return result.rows;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async updateTwitterPoints(userId: string, points: number): Promise<void> {
    try {
      const query = `
        UPDATE users
        SET twitter_points = $1
        WHERE address = $2
      `;
      await this.dbService.query(query, [points, userId.toLowerCase()]);
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async findByName(name: string): Promise<IUser | null> {
    const lower = name.toLowerCase();
    try {
      const res = await this.dbService.query<IUser>(
        `SELECT * FROM users WHERE name = $1`,
        [lower]
      );
      return res.rows[0] || null;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async findByTelegramId(name: string): Promise<IUser | null> {
    const lower = name.toLowerCase();
    try {
      const res = await this.dbService.query<IUser>(
        `SELECT * FROM users WHERE telegram->>'id' = $1`,
        [lower]
      );
      return res.rows[0] || null;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async findByDiscordUsername(name: string): Promise<IUser | null> {
    const lower = name.toLowerCase();
    try {
      const res = await this.dbService.query<IUser>(
        `SELECT * FROM users WHERE discord = $1`,
        [lower]
      );
      return res.rows[0] || null;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async findByTwitterUsername(name: string): Promise<IUser | null> {
    try {
      const res = await this.dbService.query<IUser>(
        `SELECT * FROM users WHERE twitter = $1`,
        [name]
      );
      return res.rows[0] || null;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async findByGithubUsername(name: string): Promise<IUser | null> {
    try {
      const res = await this.dbService.query<IUser>(
        `SELECT * FROM users WHERE github = $1`,
        [name]
      );
      return res.rows[0] || null;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async updateAvatar(address: string, avatarUrl: string) {
    try {
      await this.dbService.query(`UPDATE users SET avatar = $2 WHERE address = $1`, [
        address.toLowerCase(),
        avatarUrl,
      ]);
      return { success: true };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async updateField(
    address: string,
    fieldName: keyof IUser,
    value: string | null
  ) {
    try {
      await this.dbService.query(
        `UPDATE users SET ${fieldName} = $2 WHERE address = $1`,
        [address.toLowerCase(), value]
      );
      return { success: true };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async updateUser(
    updateUserDto: UpdateUserDto
  ): Promise<IUser | { success: boolean }> {
    try {
      const { address, name, email } = updateUserDto;

      const lowerAddress = address.toLowerCase();
      const lowerEmail = email ? email.toLowerCase() : '';
      const lowerName = name.trim() ? name.toLowerCase() : '';

      const existingUser = await this.findByAddress(lowerAddress);
      if (!existingUser) {
        throw new BadRequestException('User nor found');
      }

      const fields: string[] = [];
      const values: any[] = [];
      let index = 1;
      if (name) {
        const nameRes = await this.findByName(lowerName);
        if (nameRes && nameRes.address.toString() !== lowerAddress) {
          throw new BadRequestException('Name already in use');
        }
        fields.push(`name = $${index}`);
        values.push(name);
        index++;
      }
      if (lowerEmail) {
        const emailRes = await this.findByEmail(lowerEmail);

        if (emailRes && emailRes.address.toString() !== lowerAddress) {
          throw new BadRequestException('Email already in use');
        }

        fields.push(`email = $${index}`);
        values.push(lowerEmail);
        index++;
      }

      if (fields.length === 0) {
        throw new BadRequestException('No fields to update');
      }

      values.push(lowerAddress);

      const query = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE address = $${index}
      RETURNING *
    `;

      const result = await this.dbService.query<IUser>(query, values);
      if (result.rows[0]) {
        result.rows[0].address = result.rows[0].address.toString();
      }
      return result.rows[0] || { success: true };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async getCompletedQuestsCount(userAddress: string): Promise<number> {
    const lowerAddress = userAddress.toLowerCase();
    try {
      const query = `
        SELECT COUNT(*) AS count
        FROM quest_completions
        WHERE user_address = $1
      `;
      const result = await this.dbService.query(query, [lowerAddress]);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      throw new InternalServerErrorException(
        `Ошибка при получении количества выполненных квестов: ${error.message}`
      );
    }
  }

  async getCompletedCampaignsCount(userAddress: string): Promise<number> {
    const lowerAddress = userAddress.toLowerCase();
    try {
      const query = `
        SELECT COUNT(*) AS count
        FROM campaign_completions
        WHERE user_address = $1
      `;
      const result = await this.dbService.query(query, [lowerAddress]);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      throw new InternalServerErrorException(
        `Ошибка при получении количества завершенных кампаний: ${error.message}`
      );
    }
  }

  async findByReferralCode(refCode: string): Promise<IUser | null> {
    try {
      const res = await this.dbService.query<IUser>(
        `SELECT * FROM users WHERE referral_code = $1`,
        [refCode]
      );
      return res.rows[0] || null;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
  async getLeaderboardCustom(
    startAt: string | undefined,
    endAt: string | undefined,
    excludeRef: boolean,
    limit: number,
    sortBy: 'points' | 'pyramids',
    userAddress?: string,
    includeRefWithTwitterScore?: boolean,
  ): Promise<{
    top: Array<{
      address: string;
      name: string | null;
      avatar: string | null;
      twitter: string | null;
      points: number;
      campaigns_completed: number;
      gold_pyramids: number,
      basic_pyramids: number,
      rank: number;
    }>;
  }> {
    const defaultStart = new Date('2025-01-01T00:00:00Z');
    const startDate = startAt ? new Date(startAt) : defaultStart;
    const endDate = endAt ? new Date(endAt) : new Date();

    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    const cte = `WITH user_points_aggregated AS (
    SELECT
      up.user_address,
      COALESCE(SUM(up.points), 0) AS total_points
    FROM user_points up
    JOIN users u ON u.address = up.user_address
    WHERE up.created_at BETWEEN $1 AND $2
      AND (
        ${!excludeRef ? 'TRUE' : `(
          up.point_type != 'referral' OR (
            ${includeRefWithTwitterScore ? 'TRUE' : 'FALSE'}
            AND COALESCE(u.twitter_score, 0) > 0
            AND up.point_type = 'referral'
          )
        )`}
      )
    GROUP BY up.user_address
  ),
  campaigns_completed_aggregated AS (
    SELECT
      cc.user_address,
      COUNT(*) AS campaigns_completed
    FROM campaign_completions cc
    WHERE cc.completed_at BETWEEN $1 AND $2
    GROUP BY cc.user_address
  ),
  user_pyramids AS (
    SELECT
      u.address,
      SUM((p.value->>'gold')::INTEGER) AS gold_pyramids,
      SUM((p.value->>'basic')::INTEGER) AS basic_pyramids
    FROM users u,
    LATERAL jsonb_each(u.pyramids_info) AS p
    GROUP BY u.address
  ),
  ranked_users AS (
    SELECT
      u.address,
      u.name,
      u.avatar,
      u.twitter,
      COALESCE(upa.total_points, 0) AS total_points,
      COALESCE(cca.campaigns_completed, 0) AS campaigns_completed,
      COALESCE(up.gold_pyramids, 0) AS gold_pyramids,
      COALESCE(up.basic_pyramids, 0) AS basic_pyramids,
      ROW_NUMBER() OVER (
        ORDER BY
          ${sortBy === 'pyramids' ? 'gold_pyramids DESC NULLS LAST, basic_pyramids DESC NULLS LAST' : 'total_points DESC'}
      ) AS rank
    FROM users u
    LEFT JOIN user_points_aggregated upa ON u.address = upa.user_address
    LEFT JOIN campaigns_completed_aggregated cca ON u.address = cca.user_address
    LEFT JOIN user_pyramids up ON u.address = up.address
    WHERE COALESCE(upa.total_points, 0) > 0
  )`;

    const topNsql = `
    ${cte}
    SELECT
      address,
      name,
      avatar,
      twitter,
      total_points,
      campaigns_completed,
      gold_pyramids,
      basic_pyramids,
      rank
    FROM ranked_users
    ORDER BY rank
    LIMIT $3
  `;

    if (!userAddress) {
      try {
        const topRes = await this.dbService.query(topNsql, [startIso, endIso, limit]);
        const top = topRes.rows.map((row) => ({
          address: row.address,
          name: row.name,
          avatar: row.avatar,
          twitter: row.twitter,
          points: Number(row.total_points),
          campaigns_completed: Number(row.campaigns_completed),
          gold_pyramids: Number(row.gold_pyramids),
          basic_pyramids: Number(row.basic_pyramids),
          rank: Number(row.rank),
        }));
        return { top };
      } catch (error) {
        throw new InternalServerErrorException(error.message);
      }
    }

    const userRankSql = `
    ${cte}
    SELECT
      address,
      name,
      avatar,
      twitter,
      total_points,
      campaigns_completed,
      gold_pyramids,
      basic_pyramids,
      rank
    FROM ranked_users
    WHERE address = $3
  `;

    try {
      const [topRes, userRes] = await Promise.all([
        this.dbService.query(topNsql, [startIso, endIso, limit]),
        this.dbService.query(userRankSql, [startIso, endIso, userAddress.toLowerCase()]),
      ]);

      const top = topRes.rows.map((r) => ({
        address: r.address,
        name: r.name,
        avatar: r.avatar,
        twitter: r.twitter,
        points: Number(r.total_points),
        campaigns_completed: Number(r.campaigns_completed),
        gold_pyramids: Number(r.gold_pyramids),
        basic_pyramids: Number(r.basic_pyramids),
        rank: Number(r.rank),
      }));

      if (userRes.rows.length === 0) {
        return { top };
      }

      const userRow = userRes.rows[0];
      const userRank = Number(userRow.rank);

      if (userRank > limit) {
        top.push({
          address: userRow.address,
          name: userRow.name,
          avatar: userRow.avatar,
          twitter: userRow.twitter,
          points: Number(userRow.total_points),
          campaigns_completed: Number(userRow.campaigns_completed),
          gold_pyramids: Number(userRow.gold_pyramids),
          basic_pyramids: Number(userRow.basic_pyramids),
          rank: userRank,
        });
      }

      return { top };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }


  async createUserWithReferral(address: string): Promise<IUser> {
    const lower = address.toLowerCase();
    try {
      let refCode: string;

      do {
        refCode = this.generateShortCode(5);
      } while (await this.isReferralCodeExists(refCode));
      const result = await this.dbService.query<IUser>(
        `INSERT INTO users (address, name, referral_code)
         VALUES ($1, $1, $2)
         RETURNING *`,
        [lower, refCode]
      );

      return result.rows[0];
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  private async isReferralCodeExists(code: string): Promise<boolean> {
    const result = await this.dbService
      .query(`SELECT 1 FROM users WHERE referral_code = $1`, [code]);
    return result.rows.length > 0;
  }

  private generateShortCode(length: number): string {
    return Math.random()
      .toString(36)
      .slice(2, 2 + length)
      .toUpperCase();
  }

  async findUsersWithPoints(): Promise<{ address: string; points: number }[]> {
    const res = await this.dbService.query(`
        SELECT address, points
        FROM users
        WHERE points > 0
      `);
    return res.rows;
  }

  async findUsersWithPointAfterSpecificAddress(
    address: string
  ): Promise<{ address: string; points: number }[]> {
    const res = await this.dbService.query(
      `
          SELECT address, points
          FROM users
          WHERE points > 0
            AND address > $1
          ORDER BY address;
      `,
      [address]
    );
    return res.rows;
  }

  async updatePoints(
    address: string,
    points: number,
    pointType: 'base_campaign' | 'base_quest' | 'referral',
    campaignId?: string
  ) {
    const lower = address.toLowerCase();
    const user = await this.findByAddress(address);
    const userPoints = user.points.total;

    try {
      if (pointType === 'base_campaign' && campaignId) {
        await this.dbService.query(
          `INSERT INTO user_points (user_address, points, point_type, campaign_id, points_before, points_after)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [lower, points, pointType, campaignId, user.points.total, userPoints + points]
        );
      } else {
        await this.dbService.query(
          `INSERT INTO user_points (user_address, points, point_type, points_before, points_after)
           VALUES ($1, $2, $3, $4, $5)`,
          [lower, points, pointType, user.points.total, userPoints + points]
        );
      }

      const totalPoints = userPoints + points;
      await this.dbService.query(
        `UPDATE users
         SET points = $1
         WHERE address = $2`,
        [totalPoints, lower]
      );

    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }


  async getTotalPointsByType(address: string): Promise<Record<string, number>> {
    const lower = address.toLowerCase();
    try {
      const result = await this.dbService.query(
        `SELECT point_type, SUM(points) AS total
         FROM user_points
         WHERE user_address = $1
         GROUP BY point_type`,
        [lower]
      );
      const data: Record<string, number> = {};
      for (const row of result.rows) {
        data[row.point_type] = Number(row.total);
      }
      return data;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async getReferralsCount(address: string): Promise<number> {
    const lower = address.toLowerCase();
    try {
      const result = await this.dbService
        .query(`SELECT COUNT(*) AS cnt FROM users WHERE ref_owner = $1`, [
          lower,
        ]);
      return parseInt(result.rows[0].cnt, 10) || 0;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async setRefOwner(referredAddress: string, refOwnerAddress: string) {
    const lowerRef = referredAddress.toLowerCase();
    const lowerOwner = refOwnerAddress.toLowerCase();
    try {
      await this.dbService.query(
        `
        UPDATE users
        SET ref_owner = $1
        WHERE address = $2
        AND ref_owner IS NULL;
        `,
        [lowerOwner, lowerRef]
      );

      await this.dbService.query(
        `
        UPDATE users
        SET ref_count = ref_count + 1
        WHERE address = $1;
        `,
        [lowerOwner]
      );
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async incrementPyramid(address: string, type: PyramidType, chainId: number) {
    const lower = address.toLowerCase();
    await this.dbService.query(
      `
        UPDATE users
        SET pyramids_info = COALESCE(pyramids_info, '{}') ||
          jsonb_build_object($2::text,
            jsonb_build_object(
              $3::text,
              COALESCE((pyramids_info->($2::text)->($3::text))::int, 0) + 1
            )
          )
        WHERE address = $1
        `,
      [lower, chainId, type.toLowerCase()]
    );
  }

  async findUsersWithWalletChunk(
    offset: number,
    limit: number
  ): Promise<{ id: string; walletAddress: string }[]> {
    try {
      const query = `
        SELECT address AS id, address AS walletAddress
        FROM users
        WHERE address IS NOT NULL
        ORDER BY address
        LIMIT $1 OFFSET $2
      `;
      const result = await this.dbService.query(query, [limit, offset]);
      return result.rows;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async updateWalletPoints(userId: string, points: number): Promise<void> {
    try {
      const query = `
        UPDATE users
        SET wallet_points = $1
        WHERE address = $2
      `;
      await this.dbService.query(query, [points, userId.toLowerCase()]);
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async updateWalletAdditionalPoints(userId: string, points: number): Promise<void> {
    try {
      const query = `
        UPDATE users
        SET wallet_additional_points = $1
        WHERE address = $2
      `;
      await this.dbService.query(query, [points, userId.toLowerCase()]);
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async updateLastWalletScoreUpdate(userId: string, timestamp: Date): Promise<void> {
    try {
      const query = `
        UPDATE users
        SET last_wallet_score_update = $1
        WHERE address = $2
      `;
      await this.dbService.query(query, [timestamp, userId.toLowerCase()]);
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async getUserPointsHistory(
    page: number,
    limit: number,
    address?: string
  ): Promise<any> {
    const offset: number = (page - 1) * limit;
    try {
      let query: string;
      let params: any[];

      if (address) {
        query = `
          SELECT up.*, u.name
          FROM user_points up
          LEFT JOIN users u ON up.user_address = u.address
          WHERE up.user_address = $1
          ORDER BY up.created_at DESC
          LIMIT $2 OFFSET $3
        `;
        params = [address.toLowerCase(), limit, offset];
      } else {
        query = `
          SELECT up.*, u.name
          FROM user_points up
          LEFT JOIN users u ON up.user_address = u.address
          ORDER BY up.created_at DESC
          LIMIT $1 OFFSET $2
        `;
        params = [limit, offset];
      }

      const result = await this.dbService.query(query, params);
      return result.rows;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
