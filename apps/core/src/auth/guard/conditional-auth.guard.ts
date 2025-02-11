import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { SignatureAuthGuard } from './signature-auth.guard';

@Injectable()
export class ConditionalSignatureAuthGuard implements CanActivate {
  constructor(private readonly signatureAuthGuard: SignatureAuthGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.ENV === 'stage') {
      return true;
    }
    return (await this.signatureAuthGuard.canActivate(context)) as boolean;
  }
}
