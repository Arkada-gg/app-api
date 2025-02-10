export interface IUser {
  address: string;
  name?: string;
  email?: string;
  points?: number;
  avatar?: string;
  twitter?: string;
  discord?: string;
  telegram?: string;
  github?: string;
  created_at?: Date;
  updated_at?: Date;
  ref_owner: string;
}

export interface SessionRequest extends Request {
  userAddress: { address: string };
}

import { ApiProperty } from '@nestjs/swagger';

export class RewardDto {
  @ApiProperty({ example: 'token', description: 'Тип награды' })
  type: string;

  @ApiProperty({ example: '100', description: 'Значение награды' })
  value: string;
}

export class QuestTypeDto {
  @ApiProperty({ example: 'quiz', description: 'Тип квеста' })
  type: 'onchain' | 'quiz';

  @ApiProperty({
    example: 'contract-address',
    description: 'Адрес контракта',
    required: false,
  })
  contract?: string;

  @ApiProperty({
    example: 'method-name',
    description: 'Метод контракта',
    required: false,
  })
  method?: string;

  @ApiProperty({
    example: 'event-name',
    description: 'Событие контракта',
    required: false,
  })
  event?: string;

  @ApiProperty({
    example: 'chain-name',
    description: 'Название сети',
    required: false,
  })
  chain?: string;

  @ApiProperty({
    type: [Object],
    description: 'Слайды с вопросами и ответами',
    required: false,
    example: [
      { question: 'What is blockchain?', answers: ['Option1', 'Option2'] },
    ],
  })
  slide?: { question: string; answers: string[] }[];
}

export class QuestDto {
  @ApiProperty({ example: '12345', description: 'ID квеста' })
  id: string;

  @ApiProperty({ example: 'Quest name', description: 'Название квеста' })
  name: string;

  @ApiProperty({ example: 'Quest description', description: 'Описание квеста' })
  description: string;

  @ApiProperty({
    example: 'quest-image.png',
    description: 'Изображение квеста',
  })
  image: string;

  @ApiProperty({
    example: 'link',
    description: 'Ссылка',
  })
  link: string;

  @ApiProperty({ type: QuestTypeDto })
  value: QuestTypeDto;

  @ApiProperty({
    example: 'quiz',
    description: 'Тип квеста',
  })
  quest_type: string;

  @ApiProperty({
    example: 1,
    description: 'Последовательность выполнения квестов',
  })
  sequence: number;
}

export class GetCampaignResponse {
  @ApiProperty({ example: '12345', description: 'ID кампании' })
  id: string;

  @ApiProperty({ example: 'campaign-slug', description: 'Slug кампании' })
  slug: string;

  @ApiProperty({ example: 'Campaign name', description: 'Название кампании' })
  name: string;

  @ApiProperty({
    example: 'Campaign description',
    description: 'Описание кампании',
  })
  description: string;

  @ApiProperty({
    example: 'campaign-image.png',
    description: 'Изображение кампании',
  })
  image: string;

  @ApiProperty({ type: [RewardDto] })
  rewards: RewardDto[];

  @ApiProperty({
    example: 'promo',
    description: 'promo',
  })
  promo: string;

  @ApiProperty({
    example: '2025-01-01T00:00:00Z',
    description: 'Дата начала кампании',
  })
  startedAt: string;

  @ApiProperty({
    example: '2025-02-01T00:00:00Z',
    description: 'Дата окончания кампании',
  })
  finishedAt: string;

  @ApiProperty({ example: 100, description: 'Количество участников' })
  participants: number;

  @ApiProperty({ example: 'basic', description: 'Тип кампании' })
  type: 'basic' | 'premium';

  @ApiProperty({ example: '["dApp"]', description: 'Тэги кампании' })
  tags: string[];

  @ApiProperty({
    example: 'medium',
    description: 'easy-medium-hard',
  })
  difficulty: string;

  @ApiProperty({
    example: 'Краткое описание',
    description: 'Краткое описание',
  })
  short_description: string;
}

export class GetCampaignByIdOrSlugResponse {
  @ApiProperty({ example: '12345', description: 'ID кампании' })
  id: string;

  @ApiProperty({ example: 'campaign-slug', description: 'Slug кампании' })
  slug: string;

  @ApiProperty({ example: 'Campaign name', description: 'Название кампании' })
  name: string;

  @ApiProperty({
    example: 'Campaign description',
    description: 'Описание кампании',
  })
  description: string;

  @ApiProperty({
    example: 'campaign-image.png',
    description: 'Изображение кампании',
  })
  image: string;

  @ApiProperty({ type: [RewardDto] })
  rewards: RewardDto[];

  @ApiProperty({
    example: 'promo',
    description: 'promo',
  })
  promo: string;

  @ApiProperty({ type: [QuestDto] })
  quests: QuestDto[];

  @ApiProperty({
    example: '2025-01-01T00:00:00Z',
    description: 'Дата начала кампании',
  })
  startedAt: string;

  @ApiProperty({
    example: '2025-02-01T00:00:00Z',
    description: 'Дата окончания кампании',
  })
  finishedAt: string;

  @ApiProperty({ example: 100, description: 'Количество участников' })
  participants: number;

  @ApiProperty({ example: 'basic', description: 'Тип кампании' })
  type: 'basic' | 'premium';

  @ApiProperty({ example: '["dApp"]', description: 'Тэги кампании' })
  tags: string[];

  @ApiProperty({
    example: 'medium',
    description: 'easy-medium-hard',
  })
  difficulty: string;

  @ApiProperty({
    example: 'Краткое описание',
    description: 'Краткое описание',
  })
  short_description: string;
}

export class GetUserResponse {
  @ApiProperty({ example: '0x12345...', description: 'Адрес пользователя' })
  address: string;

  @ApiProperty({ example: 'John Doe', description: 'Имя пользователя' })
  name: string;

  @ApiProperty({
    example: 'user-avatar.png',
    description: 'URL аватара пользователя',
  })
  avatar: string;

  @ApiProperty({
    example: 'johndoe',
    description: 'Имя в Twitter',
    required: false,
  })
  twitter?: string;

  @ApiProperty({
    example: 'johndoe',
    description: 'Имя в Telegram',
    required: false,
  })
  telegram?: string;

  @ApiProperty({
    example: 'johndoe',
    description: 'Имя в Github',
    required: false,
  })
  github?: string;

  @ApiProperty({
    example: 'johndoe@example.com',
    description: 'Email пользователя',
    required: false,
  })
  email?: string;

  @ApiProperty({
    example: '250',
    description: 'Поинты пользователя',
    required: false,
  })
  points?: number;

  @ApiProperty({
    example: '2025-01-27 06:10:35.315982',
    description: 'Время создания пользователя',
    required: false,
  })
  created_at?: Date;

  @ApiProperty({
    example: '2025-01-27 06:10:35.315982',
    description: 'Время обновления пользователя',
    required: false,
  })
  updated_at?: Date;

  @ApiProperty({
    example: '250',
    description: 'Квесты завершенные юзером',
    required: false,
  })
  quests_completed?: number;

  @ApiProperty({
    example: '250',
    description: 'Кампании завершенные юзером',
    required: false,
  })
  campaigns_completed?: number;
}
