import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'production') {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/adventure_route';
    console.warn(
      '[api] DATABASE_URL not set. Using local default postgres URL for development.'
    );
  }

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  const explicitCorsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isLocalDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      const isExplicitlyAllowed = explicitCorsOrigins.includes(origin);

      if (isLocalDevOrigin || isExplicitlyAllowed) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api`);
}

void bootstrap();
