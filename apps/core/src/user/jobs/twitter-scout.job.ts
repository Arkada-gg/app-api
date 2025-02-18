import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { UserService } from '../user.service';

@Injectable()
export class TwitterScoreJob {
  private readonly logger = new Logger(TwitterScoreJob.name);

  private readonly API_KEY = process.env.TWITTER_SCOUT_API_KEY;
  private readonly BASE_URL = 'https://api.tweetscout.io/v2';

  constructor(private readonly userService: UserService) {}

  @Cron('0 0 * * 0')
  async handleTwitterScoreJob() {
    this.logger.log('Starting TwitterScoreJob');

    try {
      const BATCH_SIZE = 500;
      let offset = 0;

      while (true) {
        const users = await this.userService.findUsersWithTwitterChunk(
          offset,
          BATCH_SIZE
        );
        if (users.length === 0) {
          break;
        }

        for (const user of users) {
          const twitterHandle = user.twitterhandle;
          if (!twitterHandle) continue;

          try {
            const scoreData = await this.fetchTwitterScore(twitterHandle);
            const score = scoreData.score || 0;
            const verified = !!scoreData.verified;

            const scorePoints = 0.45 * Math.min(score, 5000);
            const verifiedPoints = verified ? 150 : 0;
            const total = Math.floor(scorePoints + verifiedPoints);

            await this.userService.setTwitterScorePoints(user.id, total);

            this.logger.log(
              `User ${user.id} (@${twitterHandle}): score=${score}, verified=${verified}, points=${total}`
            );
          } catch (err) {
            this.logger.warn(
              `Failed fetching TwitterScore for user ${user.id}: ${err.message}`
            );
          }
        }

        offset += users.length;
      }

      this.logger.log('TwitterScoreJob completed successfully.');
    } catch (error) {
      this.logger.error(`TwitterScoreJob failed: ${error.message}`);
    }
  }

  private async fetchTwitterScore(
    twitterHandle: string
  ): Promise<{ score: number; verified: boolean }> {
    const url = `${this.BASE_URL}/score/${twitterHandle}`;

    const resp = await axios.get(url, {
      headers: {
        Accept: 'application/json',
        ApiKey: `${this.API_KEY}`,
      },
    });

    return resp.data;
  }
}
