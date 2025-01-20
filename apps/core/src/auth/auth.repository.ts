import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { IUser } from './interface';

@Injectable()
export class AuthRepository {
  constructor(private readonly dbService: DatabaseService) {}

  async createOrUpdateUser(address: string): Promise<IUser> {
    const client = this.dbService.getClient();
    const lowerAddress = address.toLowerCase();

    try {
      const existing = await client.query<IUser>(
        `SELECT * FROM users WHERE address = $1`,
        [lowerAddress]
      );

      if (existing.rows.length === 0) {
        const name = address;
        await client.query(`INSERT INTO users(address, name) VALUES($1, $2)`, [
          lowerAddress,
          name,
        ]);
        return { address: lowerAddress, name };
      } else {
        return existing.rows[0];
      }
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
