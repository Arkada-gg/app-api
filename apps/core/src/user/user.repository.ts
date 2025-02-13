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

      for (const row of pointsResult.rows) {
        if (row.point_type === 'referral') {
          refPoints = +row.sum;
        } else if (row.point_type === 'base_campaign') {
          baseCampaignPoints = row.sum;
        }
      }

      user.points = {
        ref: +refPoints,
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
