import { Injectable } from '@nestjs/common';
import { QuestRepository } from './quest.repository';

@Injectable()
export class QuestService {
  constructor(private readonly questRepository: QuestRepository) {}

  async checkQuest(id: string, address: string): Promise<boolean> {
    return this.questRepository.checkQuestCompletion(id, address);
  }
}
