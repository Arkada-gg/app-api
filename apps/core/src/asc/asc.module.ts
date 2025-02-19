import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { AcsController } from './asc.controller';
import { AcsService } from './asc.service';
import { AcsJob } from './jobs/asc.job';
import { AcsSimulationController } from './asc-sim.controller';

@Module({
  imports: [UserModule],
  controllers: [AcsController, AcsSimulationController],
  providers: [AcsService, AcsJob],
  exports: [AcsService],
})
export class AscModule {}
