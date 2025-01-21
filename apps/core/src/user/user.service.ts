import { Injectable } from '@nestjs/common';
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

  async updateAvatar(address: string, file: Multer.File) {
    const avatarUrl = await this.s3Service.uploadFile(file);

    await this.userRepository.updateAvatar(address, avatarUrl);

    return { message: 'Avatar updated', avatarUrl };
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
