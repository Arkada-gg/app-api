import { Controller, Post, Body, Req } from '@nestjs/common';
import { SignupDto } from './dto/signup.dto';
import { AuthService } from './auth.service';
import { SessionRequest } from '../shared/interfaces';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: 'Авторизация' })
  @ApiResponse({ status: 200, description: 'Успешно получен профиль' })
  @ApiBody({
    description: 'Поля необходимые для регистрации',
    schema: {
      properties: {
        address: {
          type: 'string',
          example: '0xe688b84b23f322a994A53dbF8E15FA82CDB71127',
        },
        signature: {
          type: 'string',
          example: 'Welcome! This is your signature',
        },
      },
    },
  })
  async signup(@Body() signupDto: SignupDto, @Req() req: SessionRequest) {
    const user = await this.authService.signup(signupDto);
    req.session.userId = user.address;

    return {
      message: 'Signup successful',
      user,
    };
  }
}
