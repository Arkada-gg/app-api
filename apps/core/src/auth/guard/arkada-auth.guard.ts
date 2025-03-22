import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ArkadaGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const companySecret = request.headers['x-arkada-secret'];
    if (companySecret && companySecret === process.env.ARKADA_SECRET) {
      return true;
    }
    throw new UnauthorizedException('Access denied');
  }
}
