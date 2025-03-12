import { Injectable } from '@nestjs/common';
import { PinataSDK } from 'pinata';
import { ConfigService } from '../_config/config.service';

@Injectable()
export class IpfsService {
  private pinata?: PinataSDK;

  constructor(private configService: ConfigService) {}

  async getPinata(): Promise<PinataSDK> {
    if (!this.pinata) {
      this.pinata = new PinataSDK({
        pinataJwt: this.configService.get('PINATA_JWT'),
        pinataGateway: this.configService.get('GATEWAY_URL'),
      });
    }

    return this.pinata;
  }

  async uploadJson(json: any, name: string, keyvalues: Record<string, string>) {
    const pinata = await this.getPinata();
    const result = await pinata.upload.public
      .json(json)
      .name(name)
      .keyvalues(keyvalues);
    return new URL(
      `/ipfs/${result.cid}`,
      `https://${this.configService.get('GATEWAY_URL')}`
    ).toString();
  }
}
