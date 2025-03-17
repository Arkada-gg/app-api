import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SignatureAuthGuard } from './guard/signature-auth.guard';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @UseGuards(SignatureAuthGuard)
  @ApiOperation({ summary: 'Авторизация с реф-кодом (необязательно)' })
  @ApiResponse({ status: 200, description: 'Успешная регистрация/логин' })
  @ApiBody({
    schema: {
      properties: {
        address: {
          type: 'string',
          example: '0xe688b84b23f322a994A53dbF8E15FA82CDB71127',
        },
        signature: {
          type: 'string',
          example: '0x7520b00a...',
        },
      },
    },
  })
  async signup(@Body() signupDto: SignupDto) {
    const user = await this.authService.signup(signupDto);
    return {
      message: 'Signup successful',
      user,
    };
  }
}
