import { Controller, Get } from '@nestjs/common';

@Controller('healthz')
export class HealthzController {
  @Get()
  checkHealth(): string {
    console.log('Alive>>');
    return 'OK';
  }
}
