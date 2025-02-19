import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { AcsController } from './asc.controller';
import { AcsService } from './asc.service';
import { AcsJob } from './jobs/asc.job';

@Module({
  imports: [UserModule],
  controllers: [AcsController],
  providers: [AcsService, AcsJob],
  exports: [AcsService],
})
export class AscModule {}
