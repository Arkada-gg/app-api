import { Controller, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import axios from 'axios';
import { UserService } from '../user/user.service';

@Controller('twitter-score')
export class TwitterScoreController {
  private readonly logger = new Logger(TwitterScoreController.name);
  private readonly API_KEY = process.env.TWITTER_SCOUT_API_KEY;
  private readonly BASE_URL = 'https://api.tweetscout.io/v2';

  constructor(private readonly userService: UserService) {}

  @Post('update')
  @ApiOperation({ summary: 'Запустить обновление Twitter Score вручную' })
  @ApiResponse({ status: 200, description: 'Обновление завершено' })
  @ApiResponse({ status: 500, description: 'Ошибка обновления' })
  async updateTwitterScores() {
    this.logger.log('Запуск обновления Twitter Score...');

    try {
      const BATCH_SIZE = 20;
      let offset = 0;

      while (true) {
        const users = await this.userService.findUsersWithTwitterChunk(
          offset,
          BATCH_SIZE
        );
        if (users.length === 0) break;

        this.logger.log(`Обрабатываем ${users.length} пользователей...`);

        const results = await Promise.allSettled(
          users.map(async (user) => {
            const twitterHandle = user.twitterhandle;
            if (!twitterHandle) return;

            try {
              const scoreData = await this.fetchTwitterScore(twitterHandle);
              const score = scoreData.score || 0;
              const verified = !!scoreData.verified;

              const scorePoints = 0.45 * Math.min(score, 5000);
              const verifiedPoints = verified ? 150 : 0;
              const total = Math.floor(scorePoints + verifiedPoints);

              await this.userService.setTwitterScorePoints(user.id, total);

              this.logger.log(
                `✅ User ${user.id} (@${twitterHandle}): score=${score}, verified=${verified}, points=${total}`
              );
            } catch (err) {
              this.logger.warn(
                `⚠️ Ошибка запроса для ${twitterHandle}: ${err.message}`
              );
            }
          })
        );

        this.logger.log(
          `Батч из ${users.length} пользователей обработан. Ожидание 10 секунд...`
        );

        await this.sleep(5000);

        offset += users.length;
      }

      this.logger.log('TwitterScore обновлен для всех пользователей.');
    } catch (error) {
      this.logger.error(`Ошибка в обновлении TwitterScore: ${error.message}`);
    }
  }

  private async fetchTwitterScore(
    twitterHandle: string
  ): Promise<{ score: number; verified: boolean }> {
    const url = `${this.BASE_URL}/score/${twitterHandle}`;

    const resp = await axios.get(url, {
      headers: {
        Accept: 'application/json',
        ApiKey: this.API_KEY,
      },
    });

    return resp.data;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
