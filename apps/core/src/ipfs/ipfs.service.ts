import { json, type JSON } from '@helia/json';
import { Injectable } from '@nestjs/common';
// import type { HeliaLibp2p } from 'helia';
// import { createHelia } from 'helia';

@Injectable()
export class IpfsService {
  private helia?: any;
  private json?: any;

  async getHelia(): Promise<any> {
    if (!this.helia) {
      const heliaLib = await import('helia'); // ESM import
      const heliaJson = await import('@helia/json');

      this.helia = await heliaLib.createHelia();
      this.json = heliaJson.json(this.helia);
    }

    return this.helia;
  }

  async onApplicationShutdown() {
    if (this.helia) {
      await this.helia.stop();
    }
  }
}
