export interface IUser {
  address: string;
  name?: string;
  email?: string;
  points?: any;
  total_points?: any;
  avatar?: string;
  twitter?: string;
  discord?: string;
  telegram?: any;
  github?: string;
  created_at?: Date;
  updated_at?: Date;
  ref_owner: string;
  referral_code: string;
  twitter_points: number;
  wallet_points: number;
  wallet_additional_points: number;
  last_wallet_score_update?: Date;
}

export interface ITransaction {
  hash: string;
  event_name: string;
  block_number: number;
  args: Record<string, any>; // JSONB can be any key-value object
  created_at: Date;
}

export enum PyramidType {
  BASIC = 'basic',
  GOLD = 'gold',
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

export class TelegramDto {
  @ApiProperty({ example: '560000232', description: 'Айди юзера в телеграм' })
  id: number;

  @ApiProperty({
    example: 'some_name123',
    description: 'Никнейм юзера в телеграм',
  })
  username: string;
}

export class PointsDto {
  @ApiProperty({ example: '100', description: 'Поинты за реферальную систему' })
  ref: number;

  @ApiProperty({ example: '100', description: 'Поинты за daily начисления' })
  daily: number;

  @ApiProperty({ example: '100', description: 'Поинты за кампании' })
  base_campaign: number;

  @ApiProperty({ example: '100', description: 'Всего поинтов' })
  total: number;
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
  started_at: string;

  @ApiProperty({
    example: '2025-02-01T00:00:00Z',
    description: 'Дата окончания кампании',
  })
  finished_at: string;

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
  difficulty: 'easy' | 'medium' | 'hard';

  @ApiProperty({
    example: 'Краткое описание',
    description: 'Краткое описание',
  })
  short_description: string;

  @ApiProperty({
    example: 'Наименование проекта',
    description: 'Краткое описание',
  })
  project_name: string;

  @ApiProperty({
    example: 'Описание проекта',
    description: 'Краткое описание',
  })
  project_description: string;

  @ApiProperty({
    example: 'IN_PROGRESS',
    description: 'Статус кампании',
  })
  status: string;

  @ApiProperty({
    example: 'урл лого',
    description: 'Лого кампании',
  })
  project_logo: string;

  @ApiProperty({
    example: '["sluggg"]',
    description: 'Категории кампании',
  })
  category: string[];

  @ApiProperty({ example: 'default', description: 'тип ивента' })
  event_type: 'default' | 'mystery' | 'special';

  @ApiProperty({ example: 'false', description: 'требуется ли минт пирамиды' })
  pyramid_required: boolean;

  @ApiProperty({ example: 1337, description: 'Chainid' })
  chain_id: number;
}

export class GetCampaignWithUserStatusResponse extends GetCampaignResponse {
  @ApiProperty({
    example: 'active | started | completed',
    description: 'Статус кампании по юзеру',
  })
  user_status: string;
}

export class GetCampaignByIdOrSlugResponse extends GetCampaignResponse {
  @ApiProperty({ type: [QuestDto] })
  quests: QuestDto[];
}

export class GetUserPointsResponse {
  @ApiProperty({ example: '100', description: 'Поинты за реферальную систему' })
  ref: number;

  @ApiProperty({ example: '100', description: 'Поинты за daily начисления' })
  daily: number;

  @ApiProperty({ example: '100', description: 'Поинты за кампании' })
  base_campaign: number;

  @ApiProperty({ example: '100', description: 'wallet_additional поинтов' })
  wallet_additional: number;

  @ApiProperty({ example: '100', description: 'wallet поинтов' })
  wallet: number;

  @ApiProperty({ example: '100', description: 'Всего поинтов' })
  total: number;
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
    type: TelegramDto,
  })
  telegram?: TelegramDto;

  @ApiProperty({
    example: 'johndoe',
    description: 'Имя в Github',
    required: false,
  })
  github?: string;

  @ApiProperty({
    example: 'johndoe',
    description: 'Имя в Discord',
    required: false,
  })
  discord?: string;

  @ApiProperty({
    example: 'johndoe@example.com',
    description: 'Email пользователя',
    required: false,
  })
  email?: string;

  @ApiProperty({
    example: 1,
    description: 'Поинты юзера',
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

  @ApiProperty({
    example: 'HG5K9',
    description: 'Реф код',
    required: false,
  })
  referral_code?: string;

  @ApiProperty({
    example: '0x12345...',
    description: 'Адрес чью рефералку использовал юзер',
    required: false,
  })
  ref_owner?: string;

  @ApiProperty({
    example: '10',
    description: 'Количество рефералов',
    required: false,
  })
  ref_count?: number;

  @ApiProperty({
    example: '10',
    description: 'Твитер скор',
    required: false,
  })
  twitter_points: number;

  @ApiProperty({
    description: 'Количество пирамид по айди сети',
  })
  pyramids_info: Record<string, Record<PyramidType, number>>;
}
