import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: +(process.env.THROTTLER_TTL ?? '60'),
        limit: +(process.env.THROTTLER_LIMIT ?? '20'),
      },
    ]),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
