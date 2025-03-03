import {
  Controller,
  Get,
  Body,
  Req,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  Param,
  UseFilters,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
  Put,
} from '@nestjs/common';
import { UserService } from './user.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { GetUserResponse, IUser, SessionRequest } from '../shared/interfaces';
import { Multer } from 'multer';
import { MulterExceptionFilter } from '../common/multer-exception.filter';
import { ethers } from 'ethers';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UpdateUserResponse } from './dto/update-user-res.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SignatureAuthGuard } from '../auth/guard/signature-auth.guard';
import { BindSocialDto } from './dto/bind-social.dto';
import { UnbindSocialDto } from './dto/unbind-social.dto';
import { SocialFieldMap } from './user.constants';
import { BindRefDto } from './dto/bind-ref.dto';
import { CreateUserEmailDto } from './dto/create-user-email.dto';

@UseFilters(MulterExceptionFilter)
@Controller('user')
@ApiTags('User')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('create-email')
  @ApiOperation({ summary: 'Создать запись (email + опционально address)' })
  @ApiBody({
    description: 'Параметры для привязки соцсети',
    schema: {
      type: 'object',
      properties: {
        address: { type: 'string', example: '0xe688b84b...' },
        email: { type: 'string', example: '0x7520b00a...' },
      },
      required: ['email'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Запись успешно создана.',
  })
  @ApiResponse({
    status: 400,
    description: 'Ошибка валидации или нарушение уникальности email/address.',
  })
  async create(@Body() createUserEmailDto: CreateUserEmailDto) {
    return this.userService.createUserEmail(createUserEmailDto);
  }

  @Post('update-user')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 1024 * 1024 },
    })
  )
  @ApiOperation({ summary: 'Обновить все поля пользователя' })
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
        name: {
          type: 'string',
          example: 'johnDoe',
        },
        email: {
          type: 'string',
          example: 'email@email.email',
        },
      },
      required: ['address', 'signature'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Пользователь успешно обновлен',
    type: UpdateUserResponse,
  })
  @ApiBadRequestResponse({
    description: 'Некорректные данные запроса или email уже используется',
  })
  @ApiNotFoundResponse({ description: 'Пользователь не найден' })
  async updateUser(
    @Req() req: SessionRequest,
    @UploadedFile() file: Multer.File,
    @Body()
    body: UpdateUserDto
  ): Promise<UpdateUserResponse> {
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
    const result = await this.userService.updateUser(body, file);
    if ('name' in result || 'email' in result || 'avatar' in result) {
      return { user: result as IUser };
    }
    return { success: true, message: 'Пользователь успешно обновлен' };
  }

  @Get(':address')
  @ApiOperation({ summary: 'Получить пользователя по адресу' })
  @ApiParam({
    name: 'address',
    description: 'Адрес пользователя',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Успешно получен профиль',
    type: GetUserResponse,
  })
  @ApiResponse({ status: 404, description: 'Пользователь не найден' })
  async getUserByHash(@Param('address') address: string) {
    const user = await this.userService.findByAddress(address);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const questsCompleted = await this.userService.getCompletedQuestsCount(
      address
    );
    const campaignsCompleted =
      await this.userService.getCompletedCampaignsCount(address);
    return {
      ...user,
      quests_completed: questsCompleted,
      campaigns_completed: campaignsCompleted,
    };
  }

  @Put('/ref/bind')
  @UseGuards(SignatureAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Привязать рефералку' })
  @ApiBody({
    description: 'Параметры для привязки соцсети',
    schema: {
      type: 'object',
      properties: {
        address: { type: 'string', example: '0xe688b84b...' },
        signature: { type: 'string', example: '0x7520b00a...' },
        refCode: {
          type: 'string',
          example: '98KJL1',
        },
      },
      required: ['address', 'signature', 'token'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Успешно получен профиль',
    type: GetUserResponse,
  })
  async bindReferral(@Body() dto: BindRefDto): Promise<IUser> {
    const { refCode, address } = dto;
    return this.userService.bindReferral(refCode, address);
  }

  @Post(':platform/bind')
  @UseGuards(SignatureAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Привязать соцсеть (Twitter/GitHub/...)' })
  @ApiBody({
    description: 'Параметры для привязки соцсети',
    schema: {
      type: 'object',
      properties: {
        address: { type: 'string', example: '0xe688b84b...' },
        signature: { type: 'string', example: '0x7520b00a...' },
        token: {
          type: 'string',
          example: 'ACCESS_TOKEN_или_другой_токен_для_API_соцсети',
        },
      },
      required: ['address', 'signature', 'token'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Соцсеть успешно привязана',
  })
  async bindSocial(
    @Param('platform') platform: string,
    @Body() dto: BindSocialDto
  ): Promise<{ success: boolean }> {
    if (!Object.keys(SocialFieldMap).includes(platform)) {
      throw new BadRequestException(
        'Only Twitter, Github, Discord and Telegram are allowed'
      );
    }
    return this.userService.bindSocial(platform.toLowerCase(), dto);
  }

  @Post(':platform/unbind')
  @UseGuards(SignatureAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Отвязать соцсеть (Twitter/GitHub/...)' })
  @ApiBody({
    description: 'Параметры для отвязки соцсети',
    schema: {
      type: 'object',
      properties: {
        address: { type: 'string', example: '0xe688b84b...' },
        signature: { type: 'string', example: '0x7520b00a...' },
      },
      required: ['address', 'signature'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Соцсеть успешно отвязана',
  })
  async unbindSocial(
    @Param('platform') platform: string,
    @Body() dto: UnbindSocialDto
  ): Promise<{ success: boolean }> {
    if (!Object.keys(SocialFieldMap).includes(platform)) {
      throw new BadRequestException(
        'Only Twitter, Github, Discord and Telegram are allowed'
      );
    }
    return this.userService.unbindSocial(platform.toLowerCase(), dto);
  }
}
