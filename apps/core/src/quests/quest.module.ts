import { Module } from '@nestjs/common';
import { QuestController } from './quest.controller';
import { QuestService } from './quest.service';
import { QuestRepository } from './quest.repository';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [QuestController],
  providers: [QuestService, QuestRepository],
})
export class QuestModule {}
