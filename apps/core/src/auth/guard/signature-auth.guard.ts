import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { ethers } from 'ethers';

@Injectable()
export class SignatureAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { address, signature } = request.body;

    if (!address || !signature) {
      throw new BadRequestException('Missing address or signature');
    }

    const rawMessage = process.env.VERIFICATION_MESSAGE || '';
    if (!rawMessage) {
      throw new BadRequestException(
        'Server misconfiguration: missing verification message'
      );
    }

    let message = rawMessage.trim();
    if (message.startsWith('"') && message.endsWith('"')) {
      message = message.slice(1, -1);
    }
    message = message.replace(/\\n/g, '\n');

    try {
      const messageHash = ethers.hashMessage(message);
      const recovered = ethers.recoverAddress(messageHash, signature);
      if (recovered.toLowerCase() !== address.toLowerCase()) {
        throw new BadRequestException('Invalid signature');
      }
      request.userAddress = { address };
      return true;
    } catch (error) {
      console.error('Signature verification error:', error);
      throw new BadRequestException(
        'Invalid signature format or verification failed'
      );
    }
  }
}
