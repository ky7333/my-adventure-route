import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './common/prisma.module';
import { HealthModule } from './health/health.module';
import { RoutesModule } from './routes/routes.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, HealthModule, AuthModule, RoutesModule]
})
export class AppModule {}
