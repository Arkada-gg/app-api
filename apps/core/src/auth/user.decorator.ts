import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { UnauthorizedException } from '@nestjs/common';

interface JwtUser {
  userId: string;
  [key: string]: any;
}

interface AuthenticatedRequest extends Request {
  session?: {
    userId?: string;
    [key: string]: any;
  };
  user?: JwtUser;
}

export const GetUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.session?.userId) {
      return request.session.userId;
    }

    if (request.user?.userId) {
      return request.user.userId;
    }

    throw new UnauthorizedException('User ID not found in request');
  },
);