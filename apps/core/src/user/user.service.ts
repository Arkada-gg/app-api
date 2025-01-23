import { BadRequestException, Injectable } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { S3Service } from '../s3/s3.service';
import { Multer } from 'multer';
import { IUser } from '../shared/interfaces';
import { ESocialPlatform, SocialFieldMap } from './user.constants';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly s3Service: S3Service
  ) {}

  async findByAddress(address: string): Promise<IUser | null> {
    return this.userRepository.findByAddress(address);
  }

  async updateUsername(address: string, username: string) {
    return this.userRepository.updateUsername(address, username);
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
}
