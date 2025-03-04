import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Post,
  Query,
} from '@nestjs/common';
import { ethers } from 'ethers';
import { soneiumProvider } from '../shared/provider';
import { UserService } from '../user/user.service';
import { DiscordBotService } from './discord.service';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('Discord')
@Controller('discord')
export class DiscordController {
  constructor(
    private readonly discordBotService: DiscordBotService,
    private readonly userService: UserService
  ) {}

  @Get('check-membership')
  @ApiOperation({
    summary: 'Проверка, является ли пользователь участником гильдии Discord',
  })
  @ApiQuery({
    name: 'guildId',
    required: true,
    description: 'ID Discord-сервера (гильдии)',
  })
  @ApiQuery({
    name: 'discordUsername',
    required: true,
    description: 'Имя пользователя в Discord (username)',
  })
  @ApiResponse({
    status: 200,
    description: 'Возвращает объект { member: true/false }',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error',
  })
  async checkMembership(
    @Query('guildId') guildId: string,
    @Query('discordUsername') userId: string
  ): Promise<{ member: boolean }> {
    const isMember = await this.discordBotService.isUserInGuildByUsername(
      guildId,
      userId
    );
    return { member: isMember };
  }

  @Post('assign-og-role')
  @ApiOperation({ summary: 'Выдача роли OG в Discord' })
  @ApiBody({
    schema: {
      properties: {
        address: {
          type: 'string',
          description: 'EVM-адрес пользователя',
          example: '0x1234abcd...5678',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description:
      'Возвращает { success: true, message: "OG роль успешно выдана" }',
  })
  @ApiResponse({
    status: 400,
    description: 'Пользователь не привязал Discord или нет нужного NFT',
  })
  @ApiResponse({
    status: 404,
    description: 'Пользователь с данным адресом не найден',
  })
  @ApiResponse({
    status: 500,
    description: 'Ошибка при выдаче роли OG',
  })
  async assignOgRole(@Body('address') userAddress: string) {
    const user = await this.userService.findByAddress(userAddress);
    if (!user) {
      throw new NotFoundException(
        `Пользователь с адресом ${userAddress} не найден`
      );
    }

    if (!user.discord) {
      throw new BadRequestException('Пользователь не привязал Discord');
    }

    const hasOgNft = await this.checkOgNft(userAddress);
    if (!hasOgNft) {
      throw new BadRequestException('У пользователя нет OG NFT');
    }

    try {
      const guildId = '1329032622353027083';
      const roleName = 'OG';

      const res = await this.discordBotService.assignRoleToUser(
        guildId,
        user.discord,
        roleName
      );
      if (!res) {
        throw new InternalServerErrorException('Не удалось назначить роль OG');
      }
      return { success: true, message: 'OG роль успешно выдана' };
    } catch (error) {
      throw new InternalServerErrorException(
        `Ошибка при выдаче роли OG: ${error.message}`
      );
    }
  }

  private async checkOgNft(address: string): Promise<boolean> {
    const ogNftAddress = '0x43a91c353620b18070ad70416f1667250a75daed';
    const minimalNftAbi = [
      'function balanceOf(address owner) view returns (uint256)',
    ];
    try {
      const contract = new ethers.Contract(
        ogNftAddress,
        minimalNftAbi,
        soneiumProvider
      );
      const balance = await contract.balanceOf(address);
      return +balance.toString() > 0;
    } catch (error) {
      throw new InternalServerErrorException(
        `Ошибка проверки NFT: ${error.message}`
      );
    }
  }
}
