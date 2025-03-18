import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthzController {
  @Get()
  checkHealth(): string {
    console.log('Alive>>');
    return 'OK';
  }
}
