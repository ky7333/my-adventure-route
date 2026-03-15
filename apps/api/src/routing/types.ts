import type { PlanRouteRequest, SurfaceMix } from '@adventure/contracts';
import type { ScoreInputSegment } from '@adventure/scoring';

export interface RawRouteCandidate {
  label: string;
  distanceKm: number;
  durationMin: number;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  surfaceMix: SurfaceMix;
  segments: ScoreInputSegment[];
  providerMeta: Record<string, unknown>;
}

export interface RoutingProvider {
  planCandidates(input: PlanRouteRequest): Promise<RawRouteCandidate[]>;
}
