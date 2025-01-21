import { IUser } from '../shared/interfaces';

export enum ESocialPlatform {
  Twitter = 'twitter',
  Github = 'github',
  Telegram = 'telegram',
}

export const SocialFieldMap: Record<ESocialPlatform, keyof IUser> = {
  [ESocialPlatform.Twitter]: 'twitter',
  [ESocialPlatform.Github]: 'github',
  [ESocialPlatform.Telegram]: 'telegram',
};
