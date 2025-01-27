import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
import { ethers } from 'ethers';
import { SignupDto } from './dto/signup.dto';
import { AuthRepository } from './auth.repository';
import { ConfigService } from '../_config/config.service';
import { IUser } from '../shared/interfaces';
import { UserService } from '../user/user.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly configService: ConfigService,
    private readonly userService: UserService
  ) {}

  async signup(signupDto: SignupDto) {
    try {
      const { address } = signupDto;
      let user = await this.userService.findByAddress(address);
      if (user) {
        return user;
      } else {
        user = await this.authRepository.createOrUpdateUser(address);
        return user;
      }
    } catch (error) {
      console.error('Error in AuthService.signup:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async findByAddress(address: string): Promise<IUser | null> {
    return this.userService.findByAddress(address);
  }
}
