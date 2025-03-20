import { Module, Global, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { _ConfigModule } from '../_config/config.module';
import { MigrationsService } from './migrations.service';

@Global()
@Module({
  providers: [DatabaseService, MigrationsService],
  exports: [DatabaseService, MigrationsService],
  imports: [_ConfigModule],
})
export class DatabaseModule implements OnModuleInit {
  constructor(private readonly migrationsService: MigrationsService) {}

  async onModuleInit() {
    await this.migrationsService.runMigrations();
  }
}
