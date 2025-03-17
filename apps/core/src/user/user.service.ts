import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { UserRepository } from './user.repository';
import { S3Service } from '../s3/s3.service';
import { Multer } from 'multer';
import { IUser } from '../shared/interfaces';
import { ESocialPlatform, SocialFieldMap } from './user.constants';
import { UpdateUserDto } from './dto/update-user.dto';
import { BindSocialDto } from './dto/bind-social.dto';
import { UnbindSocialDto } from './dto/unbind-social.dto';
import { EPointsType } from '../quests/interface';
import jwt from 'jsonwebtoken';
import { CreateUserEmailDto } from './dto/create-user-email.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly s3Service: S3Service
  ) { }

  async findByAddress(address: string): Promise<IUser | null> {
    return this.userRepository.findByAddress(address);
  }

  async createUserEmail(dto: CreateUserEmailDto) {
    const email = await this.userRepository.findEmail(dto.email);
    if (email) {
      throw new BadRequestException('Email already exists');
    }
    if (dto.address) {
      const address = await this.userRepository.findAddress(dto.address);
      if (address) {
        throw new BadRequestException('Address already exists');
      }
    }
    return await this.userRepository.createEmail(dto.email, dto.address);
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return this.userRepository.findByEmail(email);
  }

  async createUserIfNotExists(address: string): Promise<IUser> {
    const lower = address.toLowerCase();
    const existing = await this.findByAddress(lower);
    if (existing) {
      return existing;
    }
    return this.userRepository.createUserWithReferral(lower);
  }

  async bindReferral(refCode: string, address: string): Promise<IUser> {
    const lower = address.toLowerCase();
    const existingUser = await this.findByAddress(lower);
    if (!existingUser) {
      throw new BadRequestException('User not found');
    }
    if (existingUser.ref_owner) {
      throw new BadRequestException('Referral owner is already set');
    }
    const owner = await this.userRepository.findByReferralCode(refCode);
    if (!owner) {
      throw new BadRequestException('Invalid referral code');
    }
    if (owner.address.toLowerCase() === lower) {
      throw new BadRequestException('Cannot refer yourself');
    }
    await this.userRepository.setRefOwner(lower, owner.address);
    const updatedUser = await this.findByAddress(lower);
    return updatedUser;
  }

  async getLeaderboardCustom(
    startAt: string,
    endAt: string,
    doExcludeRef: boolean,
    limitNum: number,
    userAddress?: string,
    doIncludeRefWithTwScore?: boolean
  ) {
    return this.userRepository.getLeaderboardCustom(
      startAt,
      endAt,
      doExcludeRef,
      limitNum,
      userAddress,
      doIncludeRefWithTwScore
    );
  }

  async getLeaderboard(
    period: 'week' | 'month',
    includeRef: boolean,
    last: boolean,
    userAddress?: string
  ) {
    return this.userRepository.getLeaderboard(
      period,
      includeRef,
      last,
      userAddress
    );
  }

  async getUsersWithPoints(): Promise<{ address: string; points: number }[]> {
    return this.userRepository.findUsersWithPoints();
  }

  async getUsersWithPointsAfterSpecificAddress(
    address: string
  ): Promise<{ address: string; points: number }[]> {
    return this.userRepository.findUsersWithPointAfterSpecificAddress(address);
  }

  async updateUser(
    updateUserDto: UpdateUserDto,
    file: Multer.file
  ): Promise<IUser | { success: boolean }> {
    try {
      const user = await this.userRepository.findByAddress(
        updateUserDto.address
      );
      if (!user) {
        throw new BadRequestException('User not found');
      }
      if (file) {
        if (user.avatar) {
          try {
            const urlParts = user.avatar.split('/');
            const key = urlParts.slice(3).join('/');
            await this.s3Service.deleteFile(key);
          } catch (error) {
            console.error('Error deleting old avatar:', error);
          }
        }
        const newAvatarUrl = await this.s3Service.uploadFile(file);

        await this.userRepository.updateAvatar(user.address, newAvatarUrl);
      }

      const updatedUser = await this.userRepository.updateUser(updateUserDto);

      return updatedUser;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  async updateAvatar(
    address: string,
    file: Multer.File
  ): Promise<{ message: string; avatarUrl: string }> {
    const user = await this.userRepository.findByAddress(address);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.avatar) {
      try {
        const urlParts = user.avatar.split('/');
        const key = urlParts.slice(3).join('/');
        await this.s3Service.deleteFile(key);
      } catch (error) {
        console.error('Error deleting old avatar:', error);
      }
    }

    const newAvatarUrl = await this.s3Service.uploadFile(file);

    await this.userRepository.updateAvatar(address, newAvatarUrl);

    return { message: 'Avatar updated successfully', avatarUrl: newAvatarUrl };
  }

  async updateSocialPlatform(
    address: string,
    platform: ESocialPlatform,
    username: string | null
  ) {
    const fieldName = SocialFieldMap[platform];
    return this.userRepository.updateField(address, fieldName, username);
  }

  async bindSocial(
    platform: string,
    dto: BindSocialDto
  ): Promise<{ success: boolean }> {
    switch (platform) {
      case ESocialPlatform.Twitter:
        return this.bindTwitter(dto);
      case ESocialPlatform.Github:
        return this.bindGitHub(dto);
      case ESocialPlatform.Discord:
        return this.bindDiscord(dto);
      case ESocialPlatform.Telegram:
        return this.bindTelegram(dto);
      default:
        throw new BadRequestException(`Unknown platform: ${platform}`);
    }
  }

  async unbindSocial(
    platform: string,
    dto: UnbindSocialDto
  ): Promise<{ success: boolean }> {
    const allowedPlatforms = new Set(Object.keys(SocialFieldMap));
    if (!allowedPlatforms.has(platform)) {
      throw new BadRequestException('Unsupported platform');
    }

    const lowerAddress = dto.address.toLowerCase();
    await this.userRepository.updateField(
      lowerAddress,
      platform as keyof IUser,
      null
    );

    if (platform === ESocialPlatform.Twitter) {
      await this.userRepository.updateField(
        lowerAddress,
        'twitter_points',
        null
      );
    }
    return { success: true };
  }

  private async bindTwitter(dto: BindSocialDto): Promise<{ success: boolean }> {
    const { address, token } = dto;
    const lowerAddress = address.toLowerCase();
    const twitterApiUrl = 'https://api.x.com/2/users/me';

    const response = await fetch(twitterApiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const jsonResponse = await response.json();

    if (!response.ok) {
      throw new BadRequestException('Twitter token is invalid or expired');
    }
    if (!jsonResponse?.data?.username) {
      throw new BadRequestException('No username provided in Twitter response');
    }
    const twitter_username = jsonResponse.data.username;

    const existingUser = await this.userRepository.findByTwitterUsername(
      twitter_username
    );
    if (existingUser && existingUser.address.toLowerCase() !== lowerAddress) {
      throw new BadRequestException('Twitter account already taken');
    }

    await this.userRepository.updateField(
      lowerAddress,
      'twitter',
      twitter_username
    );
    return { success: true };
  }

  private async bindGitHub(dto: BindSocialDto): Promise<{ success: boolean }> {
    const { address, token } = dto;
    const lowerAddress = address.toLowerCase();
    const githubApiUrl = 'https://api.github.com/user';

    const response = await fetch(githubApiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const jsonResponse = await response.json();

    if (!response.ok) {
      throw new BadRequestException('GitHub token is invalid or expired');
    }
    if (!jsonResponse?.login) {
      throw new BadRequestException('No GitHub login found');
    }
    const githubLogin = jsonResponse.login;

    const existingUser = await this.userRepository.findByGithubUsername(
      githubLogin
    );
    if (existingUser && existingUser.address.toLowerCase() !== lowerAddress) {
      throw new BadRequestException('GitHub account already taken');
    }

    await this.userRepository.updateField(lowerAddress, 'github', githubLogin);
    return { success: true };
  }

  private async bindDiscord(dto: BindSocialDto): Promise<{ success: boolean }> {
    const { address, token } = dto;
    const lowerAddress = address.toLowerCase();
    const discordApiUrl = 'https://discord.com/api/users/@me';

    const response = await fetch(discordApiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const jsonResponse = await response.json();

    if (!response.ok) {
      throw new BadRequestException('Discord token is invalid or expired');
    }
    if (!jsonResponse?.username) {
      throw new BadRequestException('No username provided in Discord response');
    }

    const discord_username = jsonResponse.username;

    const existingUser = await this.userRepository.findByDiscordUsername(
      discord_username
    );
    if (existingUser && existingUser.address.toLowerCase() !== lowerAddress) {
      throw new BadRequestException('Discord account already taken');
    }

    await this.userRepository.updateField(
      lowerAddress,
      'discord',
      discord_username
    );
    return { success: true };
  }

  private async bindTelegram(
    dto: BindSocialDto
  ): Promise<{ success: boolean }> {
    const { address, token } = dto;
    const lowerAddress = address.toLowerCase();

    let decodedUserData: jwt.JwtPayload;
    try {
      const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!);
      if (typeof decoded === 'string') {
        throw new BadRequestException('Invalid token structure.');
      }
      decodedUserData = decoded;
    } catch (error: unknown) {
      throw new BadRequestException(
        `Token verification failed: ${(error as Error).message}`
      );
    }

    if (!decodedUserData.username) {
      throw new BadRequestException('No username provided in Telegram token');
    }
    if (!decodedUserData.id) {
      throw new BadRequestException('No user id provided in Telegram token');
    }

    const telegram_username = decodedUserData.username;
    const telegram_id = decodedUserData.id;

    const existingUser = await this.userRepository.findByTelegramId(
      telegram_id
    );
    if (existingUser && existingUser.address.toLowerCase() !== lowerAddress) {
      throw new BadRequestException('Telegram account already taken');
    }

    await this.userRepository.updateField(
      lowerAddress,
      'telegram',
      JSON.stringify({
        id: telegram_id,
        username: telegram_username,
      })
    );
    return { success: true };
  }

  async awardCampaignCompletion(address: string, basePoints: number) {
    const user = await this.findByAddress(address);
    await this.updatePoints(address, basePoints, EPointsType.Campaign);
    if (user?.ref_owner) {
      let bonus = Math.floor(basePoints * 0.01);
      if (bonus > 0 && bonus < 1) bonus = 1;
      await this.updatePoints(user.ref_owner, bonus, EPointsType.Referral);
    }
  }

  async updatePoints(address: string, points: number, pointType: any) {
    await this.userRepository.updatePoints(address, points, pointType);
  }

  async findUsersWithTwitterChunk(offset: number, batch_size: number) {
    return await this.userRepository.findUsersWithTwitterChunk(
      offset,
      batch_size
    );
  }

  async setTwitterScorePoints(userId: string, newPoints: number) {
    try {
      await this.userRepository.updateTwitterPoints(userId, newPoints);
    } catch (error) {
      throw new InternalServerErrorException(
        `setTwitterScorePoints failed: ${error.message}`
      );
    }
  }

  async getPointsDetails(
    address: string
  ): Promise<{ total: number; breakdown: Record<string, number> }> {
    const user = await this.findByAddress(address);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const breakdown = await this.userRepository.getTotalPointsByType(address);
    const total = user.points || 0;
    return { total, breakdown };
  }

  async getCompletedQuestsCount(address: string): Promise<number> {
    const completions = await this.userRepository.getCompletedQuestsCount(
      address
    );
    return completions;
  }

  async getCompletedCampaignsCount(address: string): Promise<number> {
    const completions = await this.userRepository.getCompletedCampaignsCount(
      address
    );

    return completions;
  }

  async findUsersWithWalletChunk(offset: number, batchSize: number): Promise<{ id: string; walletAddress: string }[]> {
    try {
      return await this.userRepository.findUsersWithWalletChunk(offset, batchSize);
    } catch (error) {
      throw new InternalServerErrorException(`findUsersWithWalletChunk failed: ${error.message}`);
    }
  }

  async setWalletScorePoints(userId: string, basePoints: number, additionalPoints: number): Promise<void> {
    try {
      await this.userRepository.updateWalletPoints(userId, basePoints);
      await this.userRepository.updateWalletAdditionalPoints(userId, additionalPoints);
    } catch (error) {
      throw new InternalServerErrorException(`setWalletScorePoints failed: ${error.message}`);
    }
  }

  async updateLastWalletScoreUpdate(userId: string, timestamp: Date): Promise<void> {
    try {
      await this.userRepository.updateLastWalletScoreUpdate(userId, timestamp);
    } catch (error) {
      throw new InternalServerErrorException(`updateLastWalletScoreUpdate failed: ${error.message}`);
    }
  }

}
