import { describe, expect, it } from 'vitest';
import {
  planRouteRequestSchema,
  planRouteResponseSchema,
  routeSurfaceSectionSchema,
  surfaceMixSchema
} from './index';

describe('planRouteRequestSchema', () => {
  it('rejects point-to-point route without end location', () => {
    const parsed = planRouteRequestSchema.safeParse({
      start: { label: 'A', lat: 44.4, lng: -72.7 },
      loopRide: false,
      vehicleType: 'motorcycle',
      preferences: {
        curvy: 50,
        scenic: 50,
        avoidHighways: 50,
        unpavedPreference: 50,
        difficulty: 50,
        distanceInfluence: 18
      }
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects loop routes when end is provided', () => {
    const parsed = planRouteRequestSchema.safeParse({
      start: { label: 'A', lat: 44.4, lng: -72.7 },
      end: { label: 'B', lat: 44.5, lng: -72.6 },
      loopRide: true,
      vehicleType: 'motorcycle',
      preferences: {
        curvy: 50,
        scenic: 50,
        avoidHighways: 50,
        unpavedPreference: 50,
        difficulty: 50,
        distanceInfluence: 18
      }
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects surface sections where startCoordinateIndex is greater than or equal to endCoordinateIndex', () => {
    const parsed = routeSurfaceSectionSchema.safeParse({
      startCoordinateIndex: 2,
      endCoordinateIndex: 2,
      surface: 'gravel'
    });

    expect(parsed.success).toBe(false);
  });
});

describe('surfaceMixSchema', () => {
  it('rejects surface mixes that do not sum to 100', () => {
    const parsed = surfaceMixSchema.safeParse({
      pavedPercent: 40,
      gravelPercent: 40,
      dirtPercent: 0,
      unknownPercent: 0
    });

    expect(parsed.success).toBe(false);
  });
});

describe('planRouteResponseSchema', () => {
  const baseOption = {
    id: 'opt-1',
    rank: 1,
    label: 'Option 1',
    distanceKm: 10,
    durationMin: 20,
    twistinessScore: 65,
    difficultyScore: 55,
    surfaceMix: {
      pavedPercent: 40,
      gravelPercent: 30,
      dirtPercent: 20,
      unknownPercent: 10
    },
    score: {
      curvature: 65,
      roadClass: 60,
      surface: 58,
      difficulty: 55,
      total: 60
    },
    geometry: {
      type: 'LineString' as const,
      coordinates: [
        [-72.7, 44.4],
        [-72.6, 44.5]
      ]
    }
  };

  it('accepts 1 to 3 route alternatives', () => {
    const parsed = planRouteResponseSchema.safeParse({
      routeRequestId: 'req-1',
      generatedAt: new Date().toISOString(),
      options: [baseOption]
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects more than 3 route alternatives', () => {
    const parsed = planRouteResponseSchema.safeParse({
      routeRequestId: 'req-1',
      generatedAt: new Date().toISOString(),
      options: [
        baseOption,
        { ...baseOption, id: 'opt-2', rank: 2 },
        { ...baseOption, id: 'opt-3', rank: 3 },
        { ...baseOption, id: 'opt-4', rank: 4 }
      ]
    });

    expect(parsed.success).toBe(false);
  });
});
