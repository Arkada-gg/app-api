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

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly s3Service: S3Service
  ) {}

  async findByAddress(address: string): Promise<IUser | null> {
    return this.userRepository.findByAddress(address);
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return this.userRepository.findByEmail(email);
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
      case 'twitter':
        return this.bindTwitter(dto);
      case 'github':
        return this.bindGitHub(dto);
      // ... case 'telegram': return this.bindTelegram(dto);
      default:
        throw new BadRequestException(`Unknown platform: ${platform}`);
    }
  }

  async unbindSocial(
    platform: string,
    dto: UnbindSocialDto
  ): Promise<{ success: boolean }> {
    switch (platform) {
      case 'twitter':
        return this.unbindTwitter(dto);
      case 'github':
        return this.unbindGitHub(dto);
      default:
        throw new BadRequestException(`Unknown platform: ${platform}`);
    }
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

  private async unbindTwitter(
    dto: UnbindSocialDto
  ): Promise<{ success: boolean }> {
    const lowerAddress = dto.address.toLowerCase();
    await this.userRepository.updateField(lowerAddress, 'twitter', null);
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

  private async unbindGitHub(
    dto: UnbindSocialDto
  ): Promise<{ success: boolean }> {
    const lowerAddress = dto.address.toLowerCase();
    await this.userRepository.updateField(lowerAddress, 'github', null);
    return { success: true };
  }

  async updatePoints(address: string, points: number) {
    return this.userRepository.updatePoints(address, points);
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
}
