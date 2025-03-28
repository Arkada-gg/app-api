import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { allMigrations } from './migrations';
import { PoolClient } from 'pg';

@Injectable()
export class MigrationsService {
  private readonly logger = new Logger(MigrationsService.name);

  constructor(private readonly dbService: DatabaseService) { }

  async runMigrations() {
    await using client = await this.dbService.getClient();
    await this.ensureMigrationsTable(client);
    const applied = await this.getAppliedMigrations(client);
    const pending = allMigrations.filter((m) => !applied.includes(m.name));

    pending.sort((a, b) => a.name.localeCompare(b.name));

    this.logger.log(`Found ${pending.length} pending migration(s).`);

    for (const migration of pending) {
      this.logger.log(`Applying migration: ${migration.name}...`);
      try {
        await client.query('BEGIN');
        await migration.up(client);
        await client.query(
          `INSERT INTO migrations (name, applied_at) VALUES ($1, NOW())`,
          [migration.name]
        );
        await client.query('COMMIT');
        this.logger.log(`Migration ${migration.name} applied successfully.`);
      } catch (err) {
        await client.query('ROLLBACK');
        this.logger.error(`Failed to apply migration ${migration.name}`, err);
        throw err;
      }
    }

    this.logger.log(`All pending migrations applied.`);
  }


  private async ensureMigrationsTable(client: PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP NOT NULL
      );
    `);
  }

  private async getAppliedMigrations(client: PoolClient): Promise<string[]> {
    const result = await client.query<{ name: string }>(
      `SELECT name FROM migrations`
    );
    return result.rows.map((row) => row.name);
  }
}
