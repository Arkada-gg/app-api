import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class QuestRepository {
  constructor(private readonly dbService: DatabaseService) {}

  async checkQuestCompletion(id: string, address: string): Promise<boolean> {
    const client = this.dbService.getClient();
    try {
      const query = `
        SELECT * FROM quest_completions
        WHERE quest_id = $1 AND user_address = $2
        LIMIT 1
      `;
      const result = await client.query(query, [id, address.toLowerCase()]);
      return result.rowCount > 0;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
