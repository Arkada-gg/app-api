import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiQuery } from '@nestjs/swagger';
import { UserService } from '../user/user.service';

@ApiTags('Leaderboard')
@Controller()
export class LeaderboardController {
  constructor(private readonly userService: UserService) {}

  @Get('/leaderboard')
  @ApiQuery({
    name: 'startAt',
    required: false,
    type: String,
    example: '2025-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'endAt',
    required: false,
    type: String,
    example: '2025-03-10T12:00:00.000Z',
  })
  @ApiQuery({
    name: 'excludeRef',
    required: false,
    type: Boolean,
    example: false,
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({
    name: 'address',
    required: false,
    type: String,
    example: '0xUser',
  })
  @ApiQuery({
    name: 'includeRefWithTwitterScore',
    required: false,
    type: Boolean,
    example: false,
  })
  async getLeaderboard(
    @Query('startAt') startAt?: string,
    @Query('endAt') endAt?: string,
    @Query('excludeRef') excludeRef = 'false',
    @Query('limit') limit = '50',
    @Query('address') userAddr?: string,
    @Query('includeRefWithTwitterScore') incRefTwScore = 'false'
  ) {
    const doExcludeRef = excludeRef === 'true';
    const limitNum = parseInt(limit, 10) || 50;
    const doIncludeRefWithTwScore = incRefTwScore === 'true';

    return this.userService.getLeaderboardCustom(
      startAt,
      endAt,
      doExcludeRef,
      limitNum,
      userAddr,
      doIncludeRefWithTwScore
    );
  }

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
