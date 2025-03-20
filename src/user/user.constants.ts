import { IUser } from '../shared/interfaces';

export enum ESocialPlatform {
  Twitter = 'twitter',
  Github = 'github',
  Discord = 'discord',
  Telegram = 'telegram',
}

export const SocialFieldMap: Record<ESocialPlatform, keyof IUser> = {
  [ESocialPlatform.Twitter]: 'twitter',
  [ESocialPlatform.Github]: 'github',
  [ESocialPlatform.Telegram]: 'telegram',
  [ESocialPlatform.Discord]: 'discord',
};
