import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import basicAuth from 'express-basic-auth';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(
    ['/api', '/api-json'],
    basicAuth({
      users: {
        [process.env.SWAGGER_USER || 'admin']:
          process.env.SWAGGER_PASS || 'password',
      },
      challenge: true,
    })
  );

  const config = new DocumentBuilder()
    .setTitle('Arkada API')
    .setDescription('API for Arkada services')
    .setVersion('1.0')
    .addCookieAuth('connect.sid')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

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

  await app.listen(process.env.CORE_PORT, () => {
    Logger.log(`Core Service is running on port ${process.env.CORE_PORT}`);
  });
}
bootstrap();
