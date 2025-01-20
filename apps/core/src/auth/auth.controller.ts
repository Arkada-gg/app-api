import { Controller, Post, Body, Req } from '@nestjs/common';
import { SignupDto } from './dto/signup.dto';
import { AuthService } from './auth.service';
import { SessionRequest } from '../shared/interfaces';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(@Body() signupDto: SignupDto, @Req() req: SessionRequest) {
    const user = await this.authService.signup(signupDto);
    req.session.userId = user.address;

    return {
      message: 'Signup successful',
      user,
    };
  }
}
