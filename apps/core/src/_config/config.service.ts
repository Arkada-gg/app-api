import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as path from 'path';

@Injectable()
export class ConfigService {
  constructor() {
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  }

  get(key: string): string | undefined {
    return process.env[key];
  }

  getOrThrow(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing env var: ${key}`);
    }
    return value;
  }
}
