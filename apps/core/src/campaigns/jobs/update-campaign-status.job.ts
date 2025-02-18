import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class CampaignStatusJob {
  private readonly logger = new Logger(CampaignStatusJob.name);

  constructor(private readonly dbService: DatabaseService) {}

  @Cron('*/1 * * * *')
  async handleCampaignFinishStatus() {
    this.logger.log('CampaignStatusJob started: updating FINISHED campaigns.');

    try {
      const client = this.dbService.getClient();
      await client.query(`
        UPDATE campaigns
        SET status = 'FINISHED'
        WHERE finished_at < NOW()
          AND status != 'FINISHED'
      `);

      this.logger.log('CampaignStatusJob completed: statuses updated.');
    } catch (error) {
      this.logger.error(`CampaignStatusJob failed: ${error.message}`);
    }
  }
}
