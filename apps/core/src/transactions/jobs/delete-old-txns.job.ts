import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class PurgeDailyChecksJob {
  private readonly logger = new Logger(PurgeDailyChecksJob.name);

  constructor(private readonly dbService: DatabaseService) { }

  @Cron('0 0,12 * * *')
  async handlePurgeOldRecords() {
    this.logger.log('PurgeDailyChecksJob started: removing old records in batches...');

    const client = await this.dbService.getClient();
    try {

      let totalDeleted = 0;
      const BATCH_SIZE = 5000;

      while (true) {

        const res = await client.query(`
          WITH to_delete AS (
            SELECT hash
            FROM transactions
            WHERE created_at < NOW() - INTERVAL '24 hours'
            LIMIT ${BATCH_SIZE}
          )
          DELETE FROM transactions d
          USING to_delete
          WHERE d.hash = to_delete.hash
          RETURNING d.hash
        `);

        const deletedCount = res.rowCount;
        totalDeleted += deletedCount;

        if (deletedCount < BATCH_SIZE) {
          break;
        }
      }

      this.logger.log(`PurgeDailyChecksJob completed: removed ${totalDeleted} old records.`);
    } catch (error) {
      this.logger.error(`PurgeDailyChecksJob failed: ${error.message}`);
    } finally {
      client.release();
    }
  }
}
