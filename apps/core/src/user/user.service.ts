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

  async updatePoints(address: string, points: number) {
    return this.userRepository.updatePoints(address, points);
  }
}
