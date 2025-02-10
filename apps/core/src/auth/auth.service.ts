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
      const { address, refCode } = signupDto;
      let user = await this.userService.findByAddress(address);
      if (user) {
        if (refCode && !user.ref_owner) {
          user = await this.userService.bindReferral(refCode, address);
        }
        return user;
      }
      user = await this.userService.createUserIfNotExists(address);
      if (refCode) {
        await this.userService.bindReferral(refCode, address);
      }
      return user;
    } catch (error) {
      console.error('Error in AuthService.signup:', error);
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }
}
