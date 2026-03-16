import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { GraphHopperRoutingProvider } from './graphhopper-routing.provider';

describe('GraphHopperRoutingProvider', () => {
  it('maps graphhopper paths into route candidates', async () => {
    const configService = {
      get: vi.fn((key: string, fallback: string) => {
        const map: Record<string, string> = {
          GRAPHHOPPER_BASE_URL: 'http://localhost:8989',
          GRAPHHOPPER_PROFILE: 'car',
          GRAPHHOPPER_API_KEY: ''
        };
        return map[key] ?? fallback;
      })
    } as unknown as ConfigService;

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          paths: [
            {
              distance: 100000,
              time: 7200000,
              points: {
                coordinates: [
                  [-72.7, 44.4],
                  [-72.1, 44.8]
                ]
              }
            }
          ]
        }),
        { status: 200 }
      )
    );

    const provider = new GraphHopperRoutingProvider(configService);
    provider.setHttpFetchForTesting(fetchMock as unknown as typeof fetch);

    const result = await provider.planCandidates({
      start: { label: 'A', lat: 44.4, lng: -72.7 },
      end: { label: 'B', lat: 44.8, lng: -72.1 },
      loopRide: false,
      vehicleType: '4x4',
      preferences: {
        curvy: 80,
        scenic: 60,
        avoidHighways: 70,
        unpavedPreference: 50,
        difficulty: 40
      }
    });

    expect(result).toHaveLength(1);
    expect(result[0].distanceKm).toBeCloseTo(100);
    expect(result[0].geometry.coordinates).toHaveLength(2);
    expect(
      result[0].surfaceMix.pavedPercent +
        result[0].surfaceMix.gravelPercent +
        result[0].surfaceMix.dirtPercent +
        result[0].surfaceMix.unknownPercent
    ).toBe(100);
    expect(result[0].surfaceMix.pavedPercent).toBe(0);
    expect(result[0].surfaceMix.gravelPercent).toBe(0);
    expect(result[0].surfaceMix.unknownPercent).toBe(100);
  });

  it('uses GraphHopper surface path details when present', async () => {
    const configService = {
      get: vi.fn((key: string, fallback: string) => {
        const map: Record<string, string> = {
          GRAPHHOPPER_BASE_URL: 'http://localhost:8989',
          GRAPHHOPPER_PROFILE: 'car',
          GRAPHHOPPER_API_KEY: ''
        };
        return map[key] ?? fallback;
      })
    } as unknown as ConfigService;

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          paths: [
            {
              distance: 100000,
              time: 7200000,
              points: {
                coordinates: [
                  [-72.7, 44.4],
                  [-72.5, 44.5],
                  [-72.3, 44.6],
                  [-72.1, 44.8]
                ]
              },
              details: {
                surface: [
                  ['asphalt', 0, 2],
                  ['gravel', 2, 3]
                ]
              }
            }
          ]
        }),
        { status: 200 }
      )
    );

    const provider = new GraphHopperRoutingProvider(configService);
    provider.setHttpFetchForTesting(fetchMock as unknown as typeof fetch);

    const result = await provider.planCandidates({
      start: { label: 'A', lat: 44.4, lng: -72.7 },
      end: { label: 'B', lat: 44.8, lng: -72.1 },
      loopRide: false,
      vehicleType: '4x4',
      preferences: {
        curvy: 80,
        scenic: 60,
        avoidHighways: 70,
        unpavedPreference: 50,
        difficulty: 40
      }
    });

    expect(result).toHaveLength(1);
    expect(result[0].surfaceMix.pavedPercent).toBeGreaterThan(0);
    expect(result[0].surfaceMix.gravelPercent).toBeGreaterThan(0);
  });

  it('retries without unsupported details when GraphHopper rejects path detail keys', async () => {
    const configService = {
      get: vi.fn((key: string, fallback: string) => {
        const map: Record<string, string> = {
          GRAPHHOPPER_BASE_URL: 'http://localhost:8989',
          GRAPHHOPPER_PROFILE: 'car',
          GRAPHHOPPER_API_KEY: ''
        };
        return map[key] ?? fallback;
      })
    } as unknown as ConfigService;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: 'Cannot find the path details: [surface]'
          }),
          { status: 400 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            paths: [
              {
                distance: 100000,
                time: 7200000,
                points: {
                  coordinates: [
                    [-72.7, 44.4],
                    [-72.1, 44.8]
                  ]
                },
                details: {
                  road_class: [['secondary', 0, 1]]
                }
              }
            ]
          }),
          { status: 200 }
        )
      );

    const provider = new GraphHopperRoutingProvider(configService);
    provider.setHttpFetchForTesting(fetchMock as unknown as typeof fetch);

    const result = await provider.planCandidates({
      start: { label: 'A', lat: 44.4, lng: -72.7 },
      end: { label: 'B', lat: 44.8, lng: -72.1 },
      loopRide: false,
      vehicleType: '4x4',
      preferences: {
        curvy: 80,
        scenic: 60,
        avoidHighways: 70,
        unpavedPreference: 50,
        difficulty: 40
      }
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondRetryUrl = new URL(fetchMock.mock.calls[1][0] as string);
    expect(secondRetryUrl.searchParams.getAll('details')).toEqual(['road_class']);
    expect(result).toHaveLength(1);
    expect(result[0].surfaceMix.pavedPercent).toBe(0);
    expect(result[0].surfaceMix.unknownPercent).toBe(100);
  });

  it('handles non-array hints payloads when detecting unsupported details', async () => {
    const configService = {
      get: vi.fn((key: string, fallback: string) => {
        const map: Record<string, string> = {
          GRAPHHOPPER_BASE_URL: 'http://localhost:8989',
          GRAPHHOPPER_PROFILE: 'car',
          GRAPHHOPPER_API_KEY: ''
        };
        return map[key] ?? fallback;
      })
    } as unknown as ConfigService;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            hints: {
              error: {
                details: 'Cannot find the path details: [surface]'
              }
            }
          }),
          { status: 400 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            paths: [
              {
                distance: 100000,
                time: 7200000,
                points: {
                  coordinates: [
                    [-72.7, 44.4],
                    [-72.1, 44.8]
                  ]
                }
              }
            ]
          }),
          { status: 200 }
        )
      );

    const provider = new GraphHopperRoutingProvider(configService);
    provider.setHttpFetchForTesting(fetchMock as unknown as typeof fetch);

    const result = await provider.planCandidates({
      start: { label: 'A', lat: 44.4, lng: -72.7 },
      end: { label: 'B', lat: 44.8, lng: -72.1 },
      loopRide: false,
      vehicleType: '4x4',
      preferences: {
        curvy: 80,
        scenic: 60,
        avoidHighways: 70,
        unpavedPreference: 50,
        difficulty: 40
      }
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondRetryUrl = new URL(fetchMock.mock.calls[1][0] as string);
    expect(secondRetryUrl.searchParams.getAll('details')).toEqual(['road_class']);
    expect(result).toHaveLength(1);
    expect(result[0].surfaceMix.pavedPercent).toBe(0);
    expect(result[0].surfaceMix.unknownPercent).toBe(100);
  });

  it('supports GraphHopper detail tuple format [from,to,value]', async () => {
    const configService = {
      get: vi.fn((key: string, fallback: string) => {
        const map: Record<string, string> = {
          GRAPHHOPPER_BASE_URL: 'http://localhost:8989',
          GRAPHHOPPER_PROFILE: 'car',
          GRAPHHOPPER_API_KEY: ''
        };
        return map[key] ?? fallback;
      })
    } as unknown as ConfigService;

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          paths: [
            {
              distance: 50000,
              time: 3600000,
              points: {
                coordinates: [
                  [-72.7, 44.4],
                  [-72.4, 44.6]
                ]
              },
              details: {
                road_class: [[0, 1, 'secondary']]
              }
            }
          ]
        }),
        { status: 200 }
      )
    );

    const provider = new GraphHopperRoutingProvider(configService);
    provider.setHttpFetchForTesting(fetchMock as unknown as typeof fetch);

    const result = await provider.planCandidates({
      start: { label: 'A', lat: 44.4, lng: -72.7 },
      end: { label: 'B', lat: 44.6, lng: -72.4 },
      loopRide: false,
      vehicleType: '4x4',
      preferences: {
        curvy: 80,
        scenic: 60,
        avoidHighways: 70,
        unpavedPreference: 50,
        difficulty: 40
      }
    });

    expect(result).toHaveLength(1);
    expect(result[0].surfaceMix.pavedPercent).toBe(0);
    expect(result[0].surfaceMix.unknownPercent).toBe(100);
  });

  it('uses route endpoint round_trip params for loop rides without duplicating end points', async () => {
    const configService = {
      get: vi.fn((key: string, fallback: string) => {
        const map: Record<string, string> = {
          GRAPHHOPPER_BASE_URL: 'http://localhost:8989',
          GRAPHHOPPER_PROFILE: 'car',
          GRAPHHOPPER_API_KEY: ''
        };
        return map[key] ?? fallback;
      })
    } as unknown as ConfigService;

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          paths: [
            {
              distance: 50000,
              time: 3600000,
              points: {
                coordinates: [
                  [-72.7, 44.4],
                  [-72.4, 44.6],
                  [-72.7, 44.4]
                ]
              }
            }
          ]
        }),
        { status: 200 }
      )
    );

    const provider = new GraphHopperRoutingProvider(configService);
    provider.setHttpFetchForTesting(fetchMock as unknown as typeof fetch);

    await provider.planCandidates({
      start: { label: 'A', lat: 44.4, lng: -72.7 },
      loopRide: true,
      vehicleType: '4x4',
      preferences: {
        curvy: 80,
        scenic: 60,
        avoidHighways: 70,
        unpavedPreference: 50,
        difficulty: 40
      }
    });

    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestUrl.pathname).toBe('/route');
    expect(requestUrl.searchParams.get('algorithm')).toBe('round_trip');
    expect(requestUrl.searchParams.getAll('point')).toHaveLength(1);
  });
});
