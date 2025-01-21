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
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@UseFilters(MulterExceptionFilter)
@UseGuards(SessionAuthGuard)
@Controller('user')
@ApiTags('User')
@ApiCookieAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Получить профиль текущего пользователя' })
  @ApiResponse({ status: 200, description: 'Успешно получен профиль' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated (No session)' })
  async getProfile(@Req() req: SessionRequest) {
    const user = await this.userService.findByAddress(req.session.userId);
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
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Аватар обновлён' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated (No session)' })
  async updateAvatar(
    @Req() req: SessionRequest,
    @UploadedFile() file: Multer.File
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    return this.userService.updateAvatar(req.session.userId, file);
  }

  @Patch('social/:platform')
  @ApiOperation({ summary: 'Подключить или отключить соцсеть' })
  @ApiParam({ name: 'platform', enum: ['twitter', 'github', 'telegram'] })
  @ApiBody({
    description:
      'Имя пользователя (username), если нужно подключить. Пустое/отсутствует — отключить.',
    type: ConnectSocialDto,
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated (No session)' })
  async updateSocial(
    @Param('platform', new ParseEnumPipe(ESocialPlatform))
    platform: ESocialPlatform,
    @Req() req: SessionRequest,
    @Body() body: ConnectSocialDto
  ) {
    const userId: string = req.session.userId;
    const username: string = body.username || null;
    return this.userService.updateSocialPlatform(userId, platform, username);
  }
}
