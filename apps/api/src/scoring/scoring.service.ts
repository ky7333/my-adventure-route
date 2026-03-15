import { Injectable } from '@nestjs/common';
import type { RoutePreferences, VehicleType } from '@adventure/contracts';
import {
  DefaultRouteScoringEngine,
  type RouteScoreBreakdown,
  type RouteScoringEngine
} from '@adventure/scoring';
import type { RawRouteCandidate } from '../routing/types';

@Injectable()
export class ScoringService {
  private readonly engine: RouteScoringEngine = new DefaultRouteScoringEngine();

  scoreCandidate(
    vehicleType: VehicleType,
    preferences: RoutePreferences,
    candidate: RawRouteCandidate
  ): RouteScoreBreakdown {
    return this.engine.scoreRoute({
      vehicleType,
      preferences,
      segments: candidate.segments
    });
  }
}
