import { Module } from '@nestjs/common';

import { _ConfigModule } from '../_config/config.module';
import { IpfsService } from './ipfs.service';

@Module({
  imports: [_ConfigModule],
  providers: [IpfsService],
  exports: [IpfsService],
})
export class IpfsModule {}
