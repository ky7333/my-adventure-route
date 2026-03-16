import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';
import { AppModule } from './app.module';

function resolvePort(rawPort: string | undefined): number {
  if (rawPort === undefined) {
    return 3001;
  }

  const trimmed = rawPort.trim();
  if (!trimmed) {
    throw new Error('PORT cannot be empty.');
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error(`PORT must be an integer between 1 and 65535. Received: "${rawPort}"`);
  }

  return parsed;
}

async function bootstrap(): Promise<void> {
  if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'development') {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/adventure_route';
    console.warn(
      '[api] DATABASE_URL not set. Using local default postgres URL for development.'
    );
  }

  let port: number;
  try {
    port = resolvePort(process.env.PORT);
  } catch (error) {
    console.error(`[api] ${(error as Error).message}`);
    process.exit(1);
    return;
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
    .filter(Boolean)
    .flatMap((origin) => {
      try {
        return [new URL(origin).origin.toLowerCase()];
      } catch {
        console.warn(`[api] Ignoring invalid CORS_ORIGINS entry: "${origin}"`);
        return [];
      }
    });

  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      let normalizedOrigin = '';
      try {
        normalizedOrigin = new URL(origin).origin.toLowerCase();
      } catch {
        callback(new Error(`CORS blocked for invalid origin: ${origin}`));
        return;
      }

      const isLocalDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin);
      const isExplicitlyAllowed = explicitCorsOrigins.includes(normalizedOrigin);
      const allowLocalDevOrigin = process.env.NODE_ENV === 'development' && isLocalDevOrigin;

      if (allowLocalDevOrigin || isExplicitlyAllowed) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${normalizedOrigin}`));
    },
    credentials: true
  });

  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api`);
}

void bootstrap();
