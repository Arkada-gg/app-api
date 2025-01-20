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
} from '@nestjs/common';
import { UserService } from './user.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { ConnectSocialDto } from './dto/connect-social.dto';
import { SessionRequest } from '../shared/interfaces';
import { Multer } from 'multer';

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
  @UseInterceptors(FileInterceptor('file'))
  async updateAvatar(
    @Req() req: SessionRequest,
    @UploadedFile() file: Multer.File,
    @Body() dto: UpdateAvatarDto
  ) {
    if (!req.session.userId) {
      throw new UnauthorizedException('Not authenticated');
    }

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    return this.userService.updateAvatar(req.session.userId, file);
  }

  @Patch('connect/twitter')
  async connectTwitter(
    @Req() req: SessionRequest,
    @Body() body: ConnectSocialDto
  ) {
    if (!req.session.userId) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.userService.updateTwitter(req.session.userId, body.username);
  }

  @Patch('disconnect/twitter')
  async disconnectTwitter(@Req() req: SessionRequest) {
    if (!req.session.userId) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.userService.updateTwitter(req.session.userId, null);
  }

  @Patch('connect/github')
  async connectGithub(
    @Req() req: SessionRequest,
    @Body() body: ConnectSocialDto
  ) {
    if (!req.session.userId) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.userService.updateGithub(req.session.userId, body.username);
  }

  @Patch('disconnect/github')
  async disconnectGithub(@Req() req: SessionRequest) {
    if (!req.session.userId) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.userService.updateGithub(req.session.userId, null);
  }

  @Patch('connect/telegram')
  async connectTelegram(
    @Req() req: SessionRequest,
    @Body() body: ConnectSocialDto
  ) {
    if (!req.session.userId) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.userService.updateTelegram(req.session.userId, body.username);
  }

  @Patch('disconnect/telegram')
  async disconnectTelegram(@Req() req: SessionRequest) {
    if (!req.session.userId) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.userService.updateTelegram(req.session.userId, null);
  }
}
