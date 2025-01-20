import { Module, Global } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { _ConfigModule } from '../_config/config.module';

@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
  imports: [_ConfigModule],
})
export class DatabaseModule {}
