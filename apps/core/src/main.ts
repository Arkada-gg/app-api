import "./instrument";
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import * as basicAuth from 'express-basic-auth';
import * as session from 'express-session';
import { AppModule } from './app.module';




import * as Sentry from "@sentry/nestjs"

async function bootstrap() {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));

  Sentry.setupExpressErrorHandler(app);

  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    })
  );
  // app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({
    origin: [
      'https://dev-app-api.arkada.gg',
      'https://dev-app.arkada.gg',
      'https://app.arkada.gg',
      'https://api.arkada.gg',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'https://dashboard.galxe.com',
      'https://galxe.com',
      'https://app-galxe.com',
      'https://app-ui-git-viewer-arkadaminds-projects.vercel.app',
      'https://166b39d2.landing-dev-7nt.pages.dev',
      'https://www.arkada.gg',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
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
        secure: true, // if we switch to HTTPS ===> true
        maxAge: 1000 * 60 * 60, // 1h
      },
    })
  );

  // app.use(
  //   rateLimit({
  //     windowMs: 15 * 60 * 1000,
  //     max: 50,
  //     message: 'Too many requests from this IP, please try again later.',
  //   })
  // );

  await app.listen(process.env.CORE_PORT, () => {
    Logger.log(`Core Service is running on port ${process.env.CORE_PORT}`);
  });
}
bootstrap();
