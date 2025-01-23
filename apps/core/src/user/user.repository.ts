import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { IUser } from '../shared/interfaces';

@Injectable()
export class UserRepository {
  constructor(private readonly dbService: DatabaseService) {}

  async findByAddress(address: string): Promise<IUser | null> {
    const client = this.dbService.getClient();
    const lower = address.toLowerCase();
    try {
      const res = await client.query<IUser>(
        `SELECT * FROM users WHERE address = $1`,
        [lower]
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

  async updateUsername(address: string, username: string) {
    const client = this.dbService.getClient();
    try {
      const result = await client.query(
        `UPDATE users SET name = $2 WHERE address = $1 RETURNING *`,
        [address.toLowerCase(), username]
      );
      return result.rows[0] || { success: true };
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
}
