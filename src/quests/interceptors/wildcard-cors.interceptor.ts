import {
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Injectable,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';

@Injectable()
export class GalxeCorsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    response.setHeader(
      'Access-Control-Allow-Origin',
      'https://dashboard.galxe.com'
    );
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

    if (request.method === 'OPTIONS') {
      response.status(204).send();
      return of(null);
    }

    return next.handle();
  }
}
