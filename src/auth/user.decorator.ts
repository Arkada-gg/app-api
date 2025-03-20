import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { UnauthorizedException } from '@nestjs/common';

interface AuthenticatedRequest extends Request {
  userAddress: string
}

export const GetUserAddress = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.userAddress) {
      return request.userAddress;
    }

    throw new UnauthorizedException('User ID not found in request');
  },
);
