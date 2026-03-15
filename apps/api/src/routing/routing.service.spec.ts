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
    difficulty: 55
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
  it('derives alternatives from provider geometry before mock fallback', async () => {
    const primary = createProviderCandidate('Primary Adventure');
    const provider: RoutingProvider = {
      planCandidates: vi.fn().mockResolvedValue([primary])
    };

    const service = new RoutingService(new MockRoutingProvider(), provider);
    const result = await service.planCandidates(request);

    expect(result).toHaveLength(3);
    expect(result[0].label).toBe('Primary Adventure');
    expect(result[1].label).toContain('(Faster)');
    expect(result[2].label).toContain('(Curvier)');
    expect(result[1].distanceKm).toBeLessThan(primary.distanceKm);
    expect(result[1].durationMin).toBeLessThan(primary.durationMin);
    expect(result[1].geometry.coordinates.length).toBeLessThanOrEqual(
      primary.geometry.coordinates.length
    );
    expect(result[2].geometry.coordinates).toHaveLength(primary.geometry.coordinates.length);
    expect(result[2].distanceKm).toBeGreaterThan(primary.distanceKm);
    expect(result[2].segments[0]?.curvature).toBeGreaterThan(primary.segments[0]?.curvature ?? 0);
    expect(result[1].providerMeta).toMatchObject({
      provider: 'graphhopper',
      derivedFrom: 'Primary Adventure',
      strategy: 'faster'
    });
    expect(result[2].providerMeta).toMatchObject({
      provider: 'graphhopper',
      derivedFrom: 'Primary Adventure',
      strategy: 'curvier'
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
