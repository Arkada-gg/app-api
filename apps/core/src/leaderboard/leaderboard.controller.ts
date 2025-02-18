import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiQuery } from '@nestjs/swagger';
import { UserService } from '../user/user.service';

@ApiTags('Leaderboard')
@Controller()
export class LeaderboardController {
  constructor(private readonly userService: UserService) {}

  @Get('/weekly-leaderboard')
  @ApiQuery({
    name: 'includeRef',
    required: false,
    type: Boolean,
    example: true,
  })
  @ApiQuery({ name: 'last', required: false, type: Boolean, example: false })
  @ApiQuery({
    name: 'userAddress',
    required: false,
    type: String,
    example: '0xUser',
  })
  async getWeeklyLeaderboard(
    @Query('includeRef') includeRef = 'true',
    @Query('last') last = 'false',
    @Query('userAddress') userAddr?: string
  ) {
    const includeReferral = includeRef !== 'false';
    const getLast = last === 'true';
    return this.userService.getLeaderboard(
      'week',
      includeReferral,
      getLast,
      userAddr
    );
  }

  @Get('/monthly-leaderboard')
  @ApiQuery({
    name: 'includeRef',
    required: false,
    type: Boolean,
    example: true,
  })
  @ApiQuery({ name: 'last', required: false, type: Boolean, example: false })
  @ApiQuery({
    name: 'address',
    required: false,
    type: String,
    example: '0xUser',
  })
  async getMonthlyLeaderboard(
    @Query('includeRef') includeRef = 'true',
    @Query('last') last = 'false',
    @Query('address') userAddr?: string
  ) {
    const includeReferral = includeRef !== 'false';
    const getLast = last === 'true';
    return this.userService.getLeaderboard(
      'month',
      includeReferral,
      getLast,
      userAddr
    );
  }
}
