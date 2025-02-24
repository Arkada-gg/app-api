import {
  Controller,
  BadRequestException,
  Get,
  Param,
  HttpException,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { QuestService } from './quest.service';
import { CheckQuestDto } from './dto/check-quest.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ethers } from 'ethers';
import { GalxeCorsInterceptor } from './interceptors/wildcard-cors.interceptor';

@ApiTags('Nft')
@Controller('nft')
export class NftController {
  constructor(private readonly questService: QuestService) {}

  @Get('hasMinted/:address')
  @UseInterceptors(GalxeCorsInterceptor)
  @ApiOperation({
    summary: 'Check if the user has minted the NFT',
    description:
      'Returns `1` if the user at :address has minted at least one NFT on a specific contract; otherwise returns `0`.',
  })
  @ApiParam({
    name: 'address',
    description: 'The user’s wallet address to check',
    required: true,
    example: '0x1234abcd...',
  })
  @ApiResponse({
    status: 200,
    description: '1 if minted, 0 if not minted',
    type: Number,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async checkHasMinted(@Param('address') address: string): Promise<number> {
    try {
      if (!ethers.isAddress(address)) {
        throw new BadRequestException('Incorrect address');
      }
      const hasMinted = await this.questService.hasMintedNft(address);
      return hasMinted ? 1 : 0;
    } catch (error) {
      throw new HttpException(
        `Error checking minted NFT: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }
}
