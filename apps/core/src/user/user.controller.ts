import {
  Controller,
  Get,
  Patch,
  Body,
  Req,
  UnauthorizedException,
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

@UseFilters(MulterExceptionFilter)
@UseGuards(SessionAuthGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  async getProfile(@Req() req: SessionRequest) {
    if (!req.session.userId) {
      throw new UnauthorizedException('Not authenticated');
    }
    const user = await this.userService.findByAddress(req.session.userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return user;
  }

  @Patch('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 1024 * 1024 },
    })
  )
  async updateAvatar(
    @Req() req: SessionRequest,
    @UploadedFile() file: Multer.File
  ) {
    if (!req.session.userId) {
      throw new UnauthorizedException('Not authenticated');
    }

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    return this.userService.updateAvatar(req.session.userId, file);
  }

  @Patch('social/:platform')
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
