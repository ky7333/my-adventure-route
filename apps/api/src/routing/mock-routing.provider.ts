import { Injectable } from '@nestjs/common';
import type { PlanRouteRequest } from '@adventure/contracts';
import type { ScoreInputSegment } from '@adventure/scoring';
import type { RawRouteCandidate, RoutingProvider } from './types';

function createSegment(seed: number, roadClass: ScoreInputSegment['roadClass']): ScoreInputSegment {
  return {
    lengthKm: 8 + seed,
    curvature: 55 + seed * 4,
    roadClass,
    surface: seed % 3 === 0 ? 'gravel' : seed % 2 === 0 ? 'dirt' : 'paved',
    technicalDifficulty: 35 + seed * 7
  };
}

function createLoopCoordinates(lat: number, lng: number, variation = 0): [number, number][] {
  const bump = 0.09 + variation * 0.02;
  return [
    [lng, lat],
    [lng + bump, lat + bump / 2],
    [lng + bump / 2, lat - bump / 2],
    [lng, lat]
  ];
}

function createLineCoordinates(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  variation = 0
): [number, number][] {
  const bend = 0.07 + variation * 0.02;
  const midLng = (start.lng + end.lng) / 2 + bend;
  const midLat = (start.lat + end.lat) / 2 + bend / 2;
  return [
    [start.lng, start.lat],
    [midLng, midLat],
    [end.lng, end.lat]
  ];
}

@Injectable()
export class MockRoutingProvider implements RoutingProvider {
  async planCandidates(input: PlanRouteRequest): Promise<RawRouteCandidate[]> {
    const variants = ['Primary Adventure', 'Alternative 1', 'Alternative 2'] as const;

    return variants.map((label, index) => {
      const coordinates = input.loopRide || !input.end
        ? createLoopCoordinates(input.start.lat, input.start.lng, index)
        : createLineCoordinates(input.start, input.end, index);

      const segments: ScoreInputSegment[] = [
        createSegment(index + 1, 'secondary'),
        createSegment(index + 2, 'tertiary'),
        createSegment(index + 3, index === 0 ? 'primary' : 'track')
      ];

      return {
        label,
        distanceKm: 78 + index * 12,
        durationMin: 105 + index * 18,
        geometry: {
          type: 'LineString',
          coordinates
        },
        surfaceMix: {
          pavedPercent: index === 0 ? 62 : 42,
          gravelPercent: index === 1 ? 36 : 24,
          dirtPercent: index === 2 ? 30 : 10,
          unknownPercent: 4
        },
        segments,
        providerMeta: {
          provider: 'mock',
          variant: label
        }
      };
    });
  }
}
