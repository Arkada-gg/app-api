import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'my-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: false, // if we switch to HTTPS ===> true
        maxAge: 1000 * 60 * 60, // 1h
      },
    })
  );

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 50,
      message: 'Too many requests from this IP, please try again later.',
    })
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  await app.listen(process.env.CORE_PORT);
}
bootstrap();
