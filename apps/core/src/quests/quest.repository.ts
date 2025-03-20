import {
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { QuestCompletionDto } from './dto/quest.competion.dto';
import { QuestTask, QuestType } from './interface';

@Injectable()
export class QuestRepository {
  constructor(private readonly dbService: DatabaseService) {
  }

  private isUUID(str: string): boolean {
    const regex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return regex.test(str);
  }

  async checkQuestCompletion(
    questId: string,
    userAddress: string
  ): Promise<boolean> {
    const lowerAddress = userAddress.toLowerCase();
    try {
        await using client = await this.dbService.getClient();

      const query = `
        SELECT 1
        FROM quest_completions
        WHERE quest_id = $1
          AND user_address = $2
        LIMIT 1
      `;
      const result = await client.query(query, [questId, lowerAddress]);
      return result.rowCount > 0;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async completeQuest(questId: string, userAddress: string): Promise<void> {
    const lowerAddress = userAddress.toLowerCase();
    try {
      await using client = await this.dbService.getClient();
      const query = `
        INSERT INTO quest_completions (quest_id, user_address, completed_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (quest_id, user_address) DO NOTHING
      `;
      await client.query(query, [questId, lowerAddress]);
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async getQuest(id: string): Promise<QuestType> {
    try {
        await using client = await this.dbService.getClient();
      const query = `
        SELECT *
        FROM quests
        WHERE id = $1
        LIMIT 1
      `;
      const result = await client.query(query, [id]);

      if (result.rowCount === 0) {
        throw new NotFoundException(`Квест с id ${id} не найден`);
      }

      const questRow = result.rows[0];
      const questTask: QuestTask = questRow.value;

      const quest: QuestType = {
        id: questRow.id,
        name: questRow.name,
        description: questRow.description,
        image: questRow.image,
        value: questTask,
        campaign_id: questRow.campaign_id,
        created_at: questRow.created_at,
        updated_at: questRow.updated_at,
        sequence: questRow.sequence,
        type: questRow.quest_type,
        link: questRow.link,
        quest_type: questRow.quest_type
      };

      return quest;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Ошибка при получении квеста: ${error.message}`
      );
    }
  }

  async getCompletedQuestsByUserInCampaign(
    campaignIdOrSlug: string,
    userAddress: string
  ): Promise<QuestCompletionDto[]> {
    const lower = userAddress.toLowerCase();
    try {
        await using client = await this.dbService.getClient();
      const all = await this.getAllCompletedQuestsByUser(lower);
      if (!all) {
        return [];
      }
      let query = '';
      const params: any[] = [lower];

      if (this.isUUID(campaignIdOrSlug)) {
        query = `
          SELECT qc.id, q.name AS quest_name, qc.completed_at, qc.transaction_hash
          FROM quest_completions qc
                 JOIN quests q ON qc.quest_id = q.id
          WHERE qc.user_address = $1
            AND q.campaign_id = $2
          ORDER BY qc.completed_at DESC;
        `;
        params.push(campaignIdOrSlug);
      } else {
        query = `
          SELECT qc.id, q.name AS quest_name, qc.completed_at, qc.transaction_hash
          FROM quest_completions qc
                 JOIN quests q ON qc.quest_id = q.id
                 JOIN campaigns c ON q.campaign_id = c.id
          WHERE qc.user_address = $1
            AND c.slug = $2
          ORDER BY qc.completed_at DESC;
        `;
        params.push(campaignIdOrSlug);
      }

      const result = await client.query(query, params);

      return result.rows.map((row) => ({
        id: row.id,
        quest_name: row.quest_name,
        completed_at: row.completed_at,
        transaction_hash: row.transaction_hash
      }));
    } catch (error) {
      throw new InternalServerErrorException(
        `Ошибка при получении выполненных квестов пользователя внутри кампании: ${error.message}`
      );
    }
  }

  async getAllCompletedQuestsByUser(
    userAddress: string
  ): Promise<QuestCompletionDto[]> {
    const lowerAddress = userAddress.toLowerCase();
    try {
        await using client = await this.dbService.getClient();

      const query = `
        SELECT qc.id, q.name AS quest_name, qc.completed_at, qc.transaction_hash
        FROM quest_completions qc
               JOIN quests q ON qc.quest_id = q.id
        WHERE qc.user_address = $1
        ORDER BY qc.completed_at DESC
      `;
      const result = await client.query(query, [lowerAddress]);
      return result.rows.map((row) => ({
        id: row.id,
        quest_name: row.quest_name,
        completed_at: row.completed_at,
        transaction_hash: row.transaction_hash
      }));
    } catch (error) {
      throw new InternalServerErrorException(
        `Ошибка при получении выполненных квестов пользователя: ${error.message}`
      );
    }
  }

  async getQuestsByCampaign(campaignId: string): Promise<QuestType[]> {
    try {
        await using client = await this.dbService.getClient();

      const query = `
        SELECT *
        FROM quests
        WHERE campaign_id = $1
        ORDER BY sequence ASC
      `;
      const result = await client.query(query, [campaignId]);

      if (result.rowCount === 0) {
        throw new NotFoundException(
          `Квесты для кампании с id ${campaignId} не найдены`
        );
      }

      const quests: QuestType[] = result.rows.map((row) => {
        const questTask: QuestTask = row.value;
        return {
          id: row.id,
          name: row.name,
          description: row.description,
          image: row.image,
          value: questTask,
          campaign_id: row.campaign_id,
          created_at: row.created_at,
          updated_at: row.updated_at,
          sequence: row.sequence,
          type: row.quest_type,
          link: row.link,
          quest_type: row.quest_type
        };
      });

      return quests;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Ошибка при получении квестов кампании: ${error.message}`
      );
    }
  }

  // async getCompletedQuestsByUserAndCompany(
  //   userId: string,
  //   companyId: string
  // ): Promise<any[]> {
  //   try {
  //     const query = `
  //       SELECT qc.id, q.name as quest_name, qc.completed_at
  //       FROM quest_completions qc
  //       JOIN quests q ON qc.quest_id = q.id
  //       JOIN users u ON qc.user_id = u.id
  //       WHERE qc.user_id = $1 AND u.company_id = $2
  //       ORDER BY qc.completed_at DESC
  //     `;
  //     const result = await this.client.query(query, [userId, companyId]);
  //     return result.rows;
  //   } catch (error) {
  //     throw new InternalServerErrorException(
  //       `Ошибка при получении выполненных квестов пользователя: ${error.message}`
  //     );
  //   }
  // }
}
