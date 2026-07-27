import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';

/**
 * Vercel's Node runtime cold-starts a new container per (idle) invocation but
 * reuses warm ones, so we build the Nest app once per container and cache it
 * on the module scope — re-running NestFactory.create per request would both
 * be slow and open a fresh Prisma/Redis connection every time.
 */
let cachedServer: ReturnType<typeof express> | null = null;

async function bootstrap() {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    rawBody: true,
  });
  const config = app.get(ConfigService);

  app.use(helmet());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({ origin: config.get<string>('CORS_ORIGIN') });

  await app.init();
  return server;
}

export default async function handler(req: Request, res: Response) {
  cachedServer ??= await bootstrap();
  cachedServer(req, res);
}
