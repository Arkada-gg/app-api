import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SignupDto } from './dto/signup.dto';
import { AuthRepository } from './auth.repository';
import { ConfigService } from '../_config/config.service';
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
      const user = await this.userService.createUserIfNotExists(
        signupDto.address
      );
      return user;
    } catch (error) {
      console.error('Error in AuthService.signup:', error);
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }
}
