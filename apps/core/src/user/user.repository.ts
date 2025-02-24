import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { IUser } from '../shared/interfaces';
import { UpdateUserDto } from './dto/update-user.dto';
import { QuestRepository } from '../quests/quest.repository';

@Injectable()
export class UserRepository {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly questRepository: QuestRepository
  ) {}

  async findByAddress(address: string): Promise<IUser | null> {
    const client = this.dbService.getClient();
    const lower = address.toLowerCase();

    try {
      const userResult = await client.query<IUser>(
        `SELECT *, COALESCE(points, 0) AS total_points FROM users WHERE address = $1`,
        [lower]
      );

      if (!userResult.rows[0]) {
        return null;
      }

      const user = userResult.rows[0];
      user.address = user.address.toString();

      const pointsResult = await client.query<{
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
        base_campaign: +baseCampaignPoints,
        total: +user.total_points,
      };

      delete user.total_points;

      return user;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async findByEmail(email: string): Promise<IUser | null> {
    const client = this.dbService.getClient();
    const lower = email.toLowerCase();
    try {
      const res = await client.query<IUser>(
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
    const client = this.dbService.getClient();
    try {
      const query = `
        SELECT address AS id, twitter AS twitterHandle
        FROM users
        WHERE twitter IS NOT NULL
        ORDER BY address
        LIMIT $1 OFFSET $2
      `;
      const result = await client.query(query, [limit, offset]);
      return result.rows;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async updateTwitterPoints(userId: string, points: number): Promise<void> {
    const client = this.dbService.getClient();
    try {
      const query = `
        UPDATE users
        SET twitter_points = $1
        WHERE address = $2
      `;
      await client.query(query, [points, userId.toLowerCase()]);
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async findByName(name: string): Promise<IUser | null> {
    const client = this.dbService.getClient();
    const lower = name.toLowerCase();
    try {
      const res = await client.query<IUser>(
        `SELECT * FROM users WHERE name = $1`,
        [lower]
      );
      return res.rows[0] || null;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async findByTelegramId(name: string): Promise<IUser | null> {
    const client = this.dbService.getClient();
    const lower = name.toLowerCase();
    try {
      const res = await client.query<IUser>(
        `SELECT * FROM users WHERE telegram->>'id' = $1`,
        [lower]
      );
      return res.rows[0] || null;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async findByDiscordUsername(name: string): Promise<IUser | null> {
    const client = this.dbService.getClient();
    const lower = name.toLowerCase();
    try {
      const res = await client.query<IUser>(
        `SELECT * FROM users WHERE discord = $1`,
        [lower]
      );
      return res.rows[0] || null;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async findByTwitterUsername(name: string): Promise<IUser | null> {
    const client = this.dbService.getClient();
    try {
      const res = await client.query<IUser>(
        `SELECT * FROM users WHERE twitter = $1`,
        [name]
      );
      return res.rows[0] || null;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async findByGithubUsername(name: string): Promise<IUser | null> {
    const client = this.dbService.getClient();
    try {
      const res = await client.query<IUser>(
        `SELECT * FROM users WHERE github = $1`,
        [name]
      );
      return res.rows[0] || null;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async updateAvatar(address: string, avatarUrl: string) {
    const client = this.dbService.getClient();
    try {
      await client.query(`UPDATE users SET avatar = $2 WHERE address = $1`, [
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
    const client = this.dbService.getClient();
    try {
      await client.query(
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
    const client = this.dbService.getClient();
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

    try {
      const result = await client.query<IUser>(query, values);
      if (result.rows[0]) {
        result.rows[0].address = result.rows[0].address.toString();
      }
      return result.rows[0] || { success: true };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async getCompletedQuestsCount(userAddress: string): Promise<number> {
    const client = this.dbService.getClient();
    const lowerAddress = userAddress.toLowerCase();
    try {
      const query = `
        SELECT COUNT(*) AS count 
        FROM quest_completions
        WHERE user_address = $1
      `;
      const result = await client.query(query, [lowerAddress]);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      throw new InternalServerErrorException(
        `Ошибка при получении количества выполненных квестов: ${error.message}`
      );
    }
  }

  async getCompletedCampaignsCount(userAddress: string): Promise<number> {
    const client = this.dbService.getClient();
    const lowerAddress = userAddress.toLowerCase();
    try {
      const query = `
        SELECT COUNT(*) AS count 
        FROM campaign_completions
        WHERE user_address = $1
      `;
      const result = await client.query(query, [lowerAddress]);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      throw new InternalServerErrorException(
        `Ошибка при получении количества завершенных кампаний: ${error.message}`
      );
    }
  }

  async findByReferralCode(refCode: string): Promise<IUser | null> {
    const client = this.dbService.getClient();
    try {
      const res = await client.query<IUser>(
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
    userAddress?: string
  ): Promise<{
    top: Array<{
      address: string;
      name: string | null;
      avatar: string | null;
      twitter: string | null;
      points: number;
      campaigns_completed: number;
      rank: number;
    }>;
  }> {
    const defaultStart = new Date('2025-01-01T00:00:00Z');
    const startDate = startAt ? new Date(startAt) : defaultStart;
    const endDate = endAt ? new Date(endAt) : new Date();

    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    const referralCondition = excludeRef
      ? `AND up.point_type != 'referral'`
      : '';
    const client = this.dbService.getClient();

    const cte = `
      WITH user_points_aggregated AS (
        SELECT
          up.user_address,
          COALESCE(SUM(up.points), 0) AS total_points
        FROM user_points up
        WHERE up.created_at BETWEEN $1 AND $2
          ${referralCondition}
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
      ranked_users AS (
        SELECT
          u.address,
          u.name,
          u.avatar,
          u.twitter,
          COALESCE(upa.total_points, 0) AS total_points,
          COALESCE(cca.campaigns_completed, 0) AS campaigns_completed,
          ROW_NUMBER() OVER (ORDER BY COALESCE(upa.total_points, 0) DESC) AS rank
        FROM users u
        LEFT JOIN user_points_aggregated upa
          ON u.address = upa.user_address
        LEFT JOIN campaigns_completed_aggregated cca
          ON u.address = cca.user_address
        WHERE COALESCE(upa.total_points, 0) > 0
      )
    `;

    const topNsql = `
      ${cte}
      SELECT
        address,
        name,
        avatar,
        twitter,
        total_points,
        campaigns_completed,
        rank
      FROM ranked_users
      ORDER BY rank
      LIMIT $3
    `;

    if (!userAddress) {
      try {
        const topRes = await client.query(topNsql, [startIso, endIso, +limit]);
        const top = topRes.rows.map((row) => ({
          address: row.address,
          name: row.name,
          avatar: row.avatar,
          twitter: row.twitter,
          points: Number(row.total_points),
          campaigns_completed: Number(row.campaigns_completed),
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
        rank
      FROM ranked_users
      WHERE address = $3
    `;

    try {
      const [topRes, userRes] = await Promise.all([
        client.query(topNsql, [startIso, endIso, limit]),
        client.query(userRankSql, [
          startIso,
          endIso,
          userAddress.toLowerCase(),
        ]),
      ]);
      console.log('------>', userRes.rows);
      const top = topRes.rows.map((r) => ({
        address: r.address,
        name: r.name,
        avatar: r.avatar,
        twitter: r.twitter,
        points: Number(r.total_points),
        campaigns_completed: Number(r.campaigns_completed),
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
          rank: userRank,
        });
      }

      return { top };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async getLeaderboard(
    period: 'week' | 'month',
    includeRef = true,
    last = false,
    userAddress?: string
  ): Promise<{
    top: Array<{
      address: string;
      name: string | null;
      avatar: string | null;
      twitter: string | null;
      points: number;
      campaigns_completed: number;
      rank: number;
    }>;
  }> {
    const client = this.dbService.getClient();

    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    if (period === 'week') {
      const dayOfWeek = (now.getDay() + 6) % 7;
      startDate = new Date(now);
      startDate.setDate(now.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);

      if (last) {
        startDate.setDate(startDate.getDate() - 7);
        endDate.setDate(endDate.getDate() - 7);
      }
    } else {
      const year = now.getFullYear();
      const month = now.getMonth();
      startDate = new Date(year, month, 1, 0, 0, 0, 0);
      endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
      if (last) {
        startDate.setMonth(startDate.getMonth() - 1);
        endDate = new Date(
          startDate.getFullYear(),
          startDate.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        );
      }
    }
    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    const excludeReferral = includeRef ? '' : `AND up.point_type != 'referral'`;

    const cte = `
      WITH user_points_aggregated AS (
        SELECT
          up.user_address,
          COALESCE(SUM(up.points), 0) AS total_points
        FROM user_points up
        WHERE up.created_at BETWEEN $1 AND $2
          ${excludeReferral}
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
      ranked_users AS (
        SELECT
          u.address,
          u.name,
          u.avatar,
          u.twitter,
          COALESCE(upa.total_points, 0) AS total_points,
          COALESCE(cca.campaigns_completed, 0) AS campaigns_completed,
          ROW_NUMBER() OVER (ORDER BY COALESCE(upa.total_points, 0) DESC) AS rank
        FROM users u
        LEFT JOIN user_points_aggregated upa
          ON u.address = upa.user_address
        LEFT JOIN campaigns_completed_aggregated cca
          ON u.address = cca.user_address
        WHERE COALESCE(upa.total_points, 0) > 0
      )
    `;

    const top50sql = `
      ${cte}
      SELECT 
        address,
        name,
        avatar,
        twitter,
        total_points,
        campaigns_completed,
        rank
      FROM ranked_users
      WHERE rank <= 50
      ORDER BY rank
    `;

    if (!userAddress) {
      const topRes = await client.query(top50sql, [startIso, endIso]);
      const top = topRes.rows.map((row) => ({
        address: row.address,
        name: row.name,
        avatar: row.avatar,
        twitter: row.twitter,
        points: Number(row.total_points),
        campaigns_completed: Number(row.campaigns_completed),
        rank: Number(row.rank),
      }));
      return { top };
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
        rank
      FROM ranked_users
      WHERE address = $3
    `;

    try {
      const [topRes, userRes] = await Promise.all([
        client.query(top50sql, [startIso, endIso]),
        client.query(userRankSql, [
          startIso,
          endIso,
          userAddress.toLowerCase(),
        ]),
      ]);
      console.log('------>', userRes);
      const top = topRes.rows.map((r) => ({
        address: r.address,
        name: r.name,
        avatar: r.avatar,
        twitter: r.twitter,
        points: Number(r.total_points),
        campaigns_completed: Number(r.campaigns_completed),
        rank: Number(r.rank),
      }));

      if (userRes.rows.length === 0) {
        return { top };
      }

      const userRow = userRes.rows[0];
      const userRank = Number(userRow.rank);

      if (userRank > 50) {
        top.push({
          address: userRow.address,
          name: userRow.name,
          avatar: userRow.avatar,
          twitter: userRow.twitter,
          points: Number(userRow.total_points),
          campaigns_completed: Number(userRow.campaigns_completed),
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

      const result = await this.dbService.getClient().query<IUser>(
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
      .getClient()
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
    const client = this.dbService.getClient();
    const res = await client.query(`
      SELECT address, points
      FROM users
      WHERE points > 0
    `);
    return res.rows;
  }

  async findUsersWithPointAfterSpecificAddress(
    address: string
  ): Promise<{ address: string; points: number }[]> {
    const client = this.dbService.getClient();
    const res = await client.query(
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
    pointType: 'base_campaign' | 'base_quest' | 'referral'
  ) {
    const lower = address.toLowerCase();
    const user = await this.findByAddress(address);
    const userPoints = user.points.total;
    const client = this.dbService.getClient();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO user_points (user_address, points, point_type)
         VALUES ($1, $2, $3)`,
        [lower, points, pointType]
      );
      const totalPoints = userPoints + points;
      await client.query(
        `UPDATE users
         SET points = $1
         WHERE address = $2`,
        [totalPoints, lower]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new InternalServerErrorException(error.message);
    }
  }

  async getTotalPointsByType(address: string): Promise<Record<string, number>> {
    const lower = address.toLowerCase();
    try {
      const result = await this.dbService.getClient().query(
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
        .getClient()
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
      const client = this.dbService.getClient();
      await client.query(
        `
        UPDATE users
        SET ref_owner = $1
        WHERE address = $2
        AND ref_owner IS NULL;
        `,
        [lowerOwner, lowerRef]
      );

      await client.query(
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
}
