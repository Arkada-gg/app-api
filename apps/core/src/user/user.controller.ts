import {
  Controller,
  Get,
  Patch,
  Body,
  Req,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Param,
  UseFilters,
  ParseEnumPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConnectSocialDto } from './dto/connect-social.dto';
import { SessionRequest } from '../shared/interfaces';
import { Multer } from 'multer';
import { SessionAuthGuard } from '../auth/guard/session-auth.guard';
import { MulterExceptionFilter } from '../common/multer-exception.filter';
import { ESocialPlatform } from './user.constants';
import { ethers } from 'ethers';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SignatureAuthGuard } from '../auth/guard/signature-auth.guard';
import { UpdateUsernameDto } from './dto/update-username.dto';

@UseFilters(MulterExceptionFilter)
@Controller('user')
@ApiTags('User')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(SessionAuthGuard)
  @Get('profile')
  @ApiOperation({ summary: 'Получить профиль текущего пользователя' })
  @ApiResponse({ status: 200, description: 'Успешно получен профиль' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated (No session)' })
  async getProfile(@Req() req: SessionRequest) {
    const user = await this.userService.findByAddress(req.userAddress.address);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return user;
  }

  @Patch('update-username')
  @UseGuards(SignatureAuthGuard)
  @ApiOperation({ summary: 'Обновить username пользователя' })
  @ApiResponse({ status: 200, description: 'Username обновлён' })
  @ApiBadRequestResponse({
    description: 'Некорректные данные или неверная подпись',
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async updateUsername(@Body() updateUsernameDto: UpdateUsernameDto) {
    const { address, username } = updateUsernameDto;
    const result = await this.userService.updateUsername(address, username);
    if (!result) {
      throw new BadRequestException('Update failed');
    }
    return { message: 'Username updated successfully', ...result };
  }

  @Get(':address')
  @ApiOperation({ summary: 'Получить пользователя по адресу' })
  @ApiParam({
    name: 'address',
    description: 'Адрес пользователя',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Пользователь найден' })
  @ApiResponse({ status: 404, description: 'Пользователь не найден' })
  async getUserByHash(@Param('address') address: string) {
    const user = await this.userService.findByAddress(address);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return user;
  }

  @Patch('avatar')
  @ApiOperation({ summary: 'Обновить аватар пользователя' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 1024 * 1024 },
    })
  )
  @ApiBody({
    description: 'Form data для загрузки аватара',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        address: {
          type: 'string',
          example: '0xe688b84b23f322a994A53dbF8E15FA82CDB71127',
        },
        signature: {
          type: 'string',
          example: '0x7520b00a05171ba73f837f6270d6e6c79d37136b...',
        },
      },
      required: ['file', 'address', 'signature'],
    },
  })
  @ApiResponse({ status: 200, description: 'Аватар обновлён' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated (No session)' })
  async updateAvatar(
    @Req() req: SessionRequest,
    @UploadedFile() file: Multer.File,
    @Body() body: { address: string; signature: string }
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const rawMessage = process.env.VERIFICATION_MESSAGE || '';
    let message = rawMessage.trim();
    if (message.startsWith('"') && message.endsWith('"')) {
      message = message.slice(1, -1);
    }
    message = message.replace(/\\n/g, '\n');

    try {
      const messageHash = ethers.hashMessage(message);
      const recovered = ethers.recoverAddress(messageHash, body.signature);
      if (recovered.toLowerCase() !== body.address.toLowerCase()) {
        throw new BadRequestException('Invalid signature');
      }
    } catch (error) {
      console.error('Signature verification error:', error);
      throw new BadRequestException('Invalid signature or verification failed');
    }

    return this.userService.updateAvatar(body.address, file);
  }

  // @UseGuards(SessionAuthGuard)
  // @ApiCookieAuth()
  // @Patch('social/:platform')
  // @UseGuards(SignatureAuthGuard)
  // @ApiOperation({ summary: 'Подключить или отключить соцсеть' })
  // @ApiParam({ name: 'platform', enum: ['twitter', 'github', 'telegram'] })
  // @ApiBody({
  //   description:
  //     'Имя пользователя (username), если нужно подключить. Пустое/отсутствует — отключить.',
  //   type: ConnectSocialDto,
  // })
  // @ApiUnauthorizedResponse({ description: 'Not authenticated (No session)' })
  // async updateSocial(
  //   @Param('platform', new ParseEnumPipe(ESocialPlatform))
  //   platform: ESocialPlatform,
  //   @Req() req: SessionRequest,
  //   @Body() body: ConnectSocialDto
  // ) {
  //   const userAddress: string = req.userAddress;
  //   const username: string = body.username || null;
  //   return this.userService.updateSocialPlatform(
  //     userAddress,
  //     platform,
  //     username
  //   );
  // }
}
