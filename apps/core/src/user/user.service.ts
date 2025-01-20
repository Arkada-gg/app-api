import { Injectable } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { S3Service } from '../s3/s3.service';
import { Multer } from 'multer';
import { IUser } from '../shared/interfaces';

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

  async updateTwitter(address: string, username: string | null) {
    return this.userRepository.updateField(address, 'twitter', username);
  }

  async updateGithub(address: string, username: string | null) {
    return this.userRepository.updateField(address, 'github', username);
  }

  async updateTelegram(address: string, username: string | null) {
    return this.userRepository.updateField(address, 'telegram', username);
  }
}
