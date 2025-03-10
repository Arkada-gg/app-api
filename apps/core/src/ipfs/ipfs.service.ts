// import { json, type JSON } from '@helia/json';
import { Injectable } from '@nestjs/common';
import type { HeliaLibp2p } from 'helia';
import { createHelia } from 'helia';

@Injectable()
export class IpfsService {
  private helia?: HeliaLibp2p;
  //   private json?: JSON;

  async getHelia(): Promise<HeliaLibp2p> {
    if (this.helia == null) {
      this.helia = await createHelia();
      //   this.json = json(this.helia);
    }

    return this.helia;
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.helia != null) {
      await this.helia.stop();
    }
  }
}
