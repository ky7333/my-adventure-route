import { describe, expect, it, vi } from 'vitest';
import { MockRoutingProvider } from './mock-routing.provider';
import { RoutingService } from './routing.service';
import type { RawRouteCandidate, RoutingProvider } from './types';

const request = {
  start: { label: 'Start', lat: 44.4759, lng: -73.2121 },
  end: { label: 'End', lat: 44.26, lng: -72.58 },
  loopRide: false,
  vehicleType: 'adv_motorcycle' as const,
  preferences: {
    curvy: 80,
    scenic: 70,
    avoidHighways: 75,
    unpavedPreference: 45,
    difficulty: 55,
    distanceInfluence: 18
  }
};

function createProviderCandidate(label: string): RawRouteCandidate {
  return {
    label,
    distanceKm: 120,
    durationMin: 150,
    geometry: {
      type: 'LineString',
      coordinates: [
        [-73.2121, 44.4759],
        [-73.02, 44.45],
        [-72.86, 44.38],
        [-72.74, 44.33],
        [-72.58, 44.26]
      ]
    },
    surfaceMix: {
      pavedPercent: 70,
      gravelPercent: 20,
      dirtPercent: 5,
      unknownPercent: 5
    },
    segments: [
      {
        lengthKm: 30,
        curvature: 70,
        roadClass: 'secondary',
        surface: 'paved',
        technicalDifficulty: 50
      },
      {
        lengthKm: 30,
        curvature: 65,
        roadClass: 'tertiary',
        surface: 'gravel',
        technicalDifficulty: 55
      }
    ],
    providerMeta: { provider: 'graphhopper' }
  };
}

describe('RoutingService', () => {
  it('returns graphhopper routes as-is when fewer than three are available', async () => {
    const primary = createProviderCandidate('Primary Adventure');
    const provider: RoutingProvider = {
      planCandidates: vi.fn().mockResolvedValue([primary])
    };

    const service = new RoutingService(new MockRoutingProvider(), provider);
    const result = await service.planCandidates(request);

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Primary Adventure');
    expect(result[0].geometry.coordinates).toEqual(primary.geometry.coordinates);
    expect(result[0].providerMeta).toMatchObject({
      provider: 'graphhopper'
    });
  });

  it('falls back to mock alternatives if provider has no candidates', async () => {
    const provider: RoutingProvider = {
      planCandidates: vi.fn().mockResolvedValue([])
    };

    const service = new RoutingService(new MockRoutingProvider(), provider);
    const result = await service.planCandidates(request);

    expect(result).toHaveLength(3);
    expect(result.every((candidate) => candidate.label.includes('(Fallback)'))).toBe(true);
  });
});
