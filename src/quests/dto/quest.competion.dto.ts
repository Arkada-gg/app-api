import { ApiProperty } from '@nestjs/swagger';

export class QuestCompletionDto {
  @ApiProperty({ description: 'Уникальный идентификатор выполнения квеста' })
  id: string;

  @ApiProperty({ description: 'Название квеста' })
  quest_name: string;

  @ApiProperty({ description: 'Дата и время выполнения квеста' })
  completed_at: Date;

  @ApiProperty({ description: 'Хеш транзакции выполнения квеста' })
  transaction_hash: string;
}
