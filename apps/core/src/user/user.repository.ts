// src/users/user.repository.ts

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { IUser } from '../shared/interfaces';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserRepository {
  constructor(private readonly dbService: DatabaseService) {}

  async findByAddress(address: string): Promise<IUser | null> {
    const client = this.dbService.getClient();
    const lower = address.toLowerCase();
    try {
      const result = await client.query<IUser>(
        `SELECT * FROM users WHERE address = $1`,
        [lower]
      );
      if (result.rows[0]) {
        result.rows[0].address = result.rows[0].address.toString();
      }
      return result.rows[0] || null;
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
    const lowerName = name ? name.toLowerCase() : '';

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
      values.push(lowerName);
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

  async updatePoints(address: string, points: number): Promise<void> {
    const client = this.dbService.getClient();

    try {
      await client.query('BEGIN');

      const query = `
        UPDATE users
        SET points = points + $1
        WHERE address = $2
        RETURNING points;
      `;

      const result = await client.query(query, [points, address]);

      if (result.rowCount === 0) {
        throw new NotFoundException('Пользователь не найден');
      }

      const updatedPoints = result.rows[0].points;

      if (updatedPoints < 0) {
        throw new BadRequestException('Баланс не может быть отрицательным');
      }

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
}
