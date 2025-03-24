import { Controller, Get, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserService } from '../user/user.service';

@ApiTags('Leaderboard')
@Controller()
export class LeaderboardController {
  constructor(private readonly userService: UserService) { }

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
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    example: 'points | pyramids',
  })
  async getLeaderboard(
    @Query('startAt') startAt?: string,
    @Query('endAt') endAt?: string,
    @Query('excludeRef') excludeRef = 'false',
    @Query('limit') limit = '50',
    @Query('address') userAddr?: string,
    @Query('includeRefWithTwitterScore') incRefTwScore = 'false',
    @Query('sortBy') sortBy: 'points' | 'pyramids' = "points"
  ) {
    const doExcludeRef = excludeRef === 'true';
    const limitNum = parseInt(limit, 10) || 50;
    const doIncludeRefWithTwScore = incRefTwScore === 'true';

    return this.userService.getLeaderboardCustom(
      startAt,
      endAt,
      doExcludeRef,
      limitNum,
      sortBy,
      userAddr,
      doIncludeRefWithTwScore,
    );
  }

}
