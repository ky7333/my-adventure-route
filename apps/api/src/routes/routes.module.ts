import { Module } from '@nestjs/common';
import { RoutingModule } from '../routing/routing.module';
import { ScoringModule } from '../scoring/scoring.module';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';

@Module({
  imports: [RoutingModule, ScoringModule],
  controllers: [RoutesController],
  providers: [RoutesService]
})
export class RoutesModule {}
