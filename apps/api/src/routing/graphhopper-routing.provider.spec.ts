import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { GraphHopperRoutingProvider } from './graphhopper-routing.provider';

function parseFetchCall(call: unknown[]): {
  url: URL;
  init: RequestInit | undefined;
  body: Record<string, unknown>;
} {
  const [requestUrlRaw, requestInit] = call as [string, RequestInit | undefined];
  const requestBodyRaw = typeof requestInit?.body === 'string' ? requestInit.body : '{}';
  return {
    url: new URL(requestUrlRaw),
    init: requestInit,
    body: JSON.parse(requestBodyRaw) as Record<string, unknown>
  };
}

describe('GraphHopperRoutingProvider', () => {
  it('requires an API key when source is cloud', () => {
    const configService = {
      get: vi.fn((key: string, fallback: string) => {
        const map: Record<string, string> = {
          GRAPHHOPPER_SOURCE: 'cloud',
          GRAPHHOPPER_PROFILE: 'car',
          GRAPHHOPPER_API_KEY: ''
        };
        return map[key] ?? fallback;
      })
    } as unknown as ConfigService;

    expect(() => new GraphHopperRoutingProvider(configService)).toThrow(
      'GRAPHHOPPER_API_KEY must be set when GRAPHHOPPER_SOURCE=cloud.'
    );
  });

  it('uses graphhopper cloud default base url when source is cloud', async () => {
    const configService = {
      get: vi.fn((key: string, fallback: string) => {
        const map: Record<string, string> = {
          GRAPHHOPPER_SOURCE: 'cloud',
          GRAPHHOPPER_PROFILE: 'car',
          GRAPHHOPPER_API_KEY: 'test-key'
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

    await provider.planCandidates({
      start: { label: 'A', lat: 44.4, lng: -72.7 },
      end: { label: 'B', lat: 44.8, lng: -72.1 },
      loopRide: false,
      vehicleType: '4x4',
      preferences: {
        curvy: 80,
        scenic: 60,
        avoidHighways: 70,
        unpavedPreference: 50,
        difficulty: 40,
        distanceInfluence: 18
      }
    });

    const request = parseFetchCall(fetchMock.mock.calls[0] as unknown[]);
    expect(request.url.origin).toBe('https://graphhopper.com');
    expect(request.url.pathname).toBe('/api/1/route');
    expect(request.url.searchParams.get('key')).toBe('test-key');
    expect(request.init?.method).toBe('POST');
    expect(request.body.algorithm).toBe('alternative_route');
    expect(request.body['alternative_route.max_paths']).toBe(3);
    expect(request.body['astarbi.epsilon']).toBe(1.6);
    expect((request.body.points as unknown[] | undefined)?.length).toBe(2);
  });

  it('returns all alternative paths so downstream ranking can choose the top 3', async () => {
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
            },
            {
              distance: 101000,
              time: 7300000,
              points: {
                coordinates: [
                  [-72.7, 44.4],
                  [-72.15, 44.85]
                ]
              }
            },
            {
              distance: 102000,
              time: 7400000,
              points: {
                coordinates: [
                  [-72.7, 44.4],
                  [-72.2, 44.9]
                ]
              }
            },
            {
              distance: 103000,
              time: 7500000,
              points: {
                coordinates: [
                  [-72.7, 44.4],
                  [-72.25, 44.95]
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
        difficulty: 40,
        distanceInfluence: 18
      }
    });

    expect(result).toHaveLength(4);
    expect(result.map((candidate) => candidate.label)).toEqual([
      'Primary Adventure',
      'Alternative 1',
      'Alternative 2',
      'Alternative 3'
    ]);
  });

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
        difficulty: 40,
        distanceInfluence: 18
      }
    });

    expect(result).toHaveLength(1);
    const request = parseFetchCall(fetchMock.mock.calls[0] as unknown[]);
    const customModel = request.body.custom_model as {
      distance_influence?: number;
      priority?: Array<{ multiply_by: string }>;
    } | undefined;
    expect(customModel).toBeTruthy();
    expect(customModel).toHaveProperty('distance_influence');
    expect(
      (customModel.priority ?? []).every((entry) => {
        const factor = Number(entry.multiply_by);
        return Number.isFinite(factor) && factor > 0 && factor <= 1;
      })
    ).toBe(true);
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
    expect(result[0].providerMeta.customModelApplied).toBe(true);
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
        difficulty: 40,
        distanceInfluence: 18
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

    const successPayload = {
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
    };

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
        new Response(JSON.stringify(successPayload), { status: 200 })
      )
      .mockResolvedValue(new Response(JSON.stringify(successPayload), { status: 200 }));

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
        difficulty: 40,
        distanceInfluence: 18
      }
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);

    const secondRetryRequest = parseFetchCall(fetchMock.mock.calls[1] as unknown[]);
    expect(secondRetryRequest.body.details).toEqual(['road_class']);
    expect(result).toHaveLength(1);
    expect(result[0].surfaceMix.pavedPercent).toBe(0);
    expect(result[0].surfaceMix.unknownPercent).toBe(100);
  });

  it('retries without custom_model if GraphHopper rejects it', async () => {
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

    const successPayload = {
      paths: [
        {
          distance: 50000,
          time: 3600000,
          points: {
            coordinates: [
              [-72.7, 44.4],
              [-72.4, 44.6]
            ]
          }
        }
      ]
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: 'Cannot parse custom_model'
          }),
          { status: 400 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(successPayload), { status: 200 })
      )
      .mockResolvedValue(new Response(JSON.stringify(successPayload), { status: 200 }));

    const provider = new GraphHopperRoutingProvider(configService);
    provider.setHttpFetchForTesting(fetchMock as unknown as typeof fetch);

    const result = await provider.planCandidates({
      start: { label: 'A', lat: 44.4, lng: -72.7 },
      end: { label: 'B', lat: 44.6, lng: -72.4 },
      loopRide: false,
      vehicleType: 'adv_motorcycle',
      preferences: {
        curvy: 80,
        scenic: 70,
        avoidHighways: 75,
        unpavedPreference: 45,
        difficulty: 55,
        distanceInfluence: 18
      }
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    const firstRequest = parseFetchCall(fetchMock.mock.calls[0] as unknown[]);
    const secondRequest = parseFetchCall(fetchMock.mock.calls[1] as unknown[]);
    expect(firstRequest.body.custom_model).toBeTruthy();
    expect(secondRequest.body.custom_model).toBeUndefined();
    expect(result[0]?.providerMeta.customModelApplied).toBe(false);
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

    const successPayload = {
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
    };

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
        new Response(JSON.stringify(successPayload), { status: 200 })
      )
      .mockResolvedValue(new Response(JSON.stringify(successPayload), { status: 200 }));

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
        difficulty: 40,
        distanceInfluence: 18
      }
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);

    const secondRetryRequest = parseFetchCall(fetchMock.mock.calls[1] as unknown[]);
    expect(secondRetryRequest.body.details).toEqual(['road_class']);
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
        difficulty: 40,
        distanceInfluence: 18
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
        difficulty: 40,
        distanceInfluence: 18
      }
    });

    const request = parseFetchCall(fetchMock.mock.calls[0] as unknown[]);
    expect(request.url.pathname).toBe('/route');
    expect(request.body.algorithm).toBe('round_trip');
    expect((request.body.points as unknown[] | undefined)?.length).toBe(1);
  });

  it('maps vehicle type to a profile-specific GraphHopper profile per request', async () => {
    const configService = {
      get: vi.fn((key: string, fallback: string) => {
        const map: Record<string, string> = {
          GRAPHHOPPER_BASE_URL: 'http://localhost:8989',
          GRAPHHOPPER_PROFILE: 'car',
          GRAPHHOPPER_PROFILE_MOTORCYCLE: 'motorcycle',
          GRAPHHOPPER_PROFILE_ADV_MOTORCYCLE: 'car',
          GRAPHHOPPER_PROFILE_4X4: 'small_truck',
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
      end: { label: 'B', lat: 44.6, lng: -72.4 },
      loopRide: false,
      vehicleType: '4x4',
      preferences: {
        curvy: 50,
        scenic: 50,
        avoidHighways: 50,
        unpavedPreference: 50,
        difficulty: 50,
        distanceInfluence: 18
      }
    });

    const request = parseFetchCall(fetchMock.mock.calls[0] as unknown[]);
    expect(request.body.profile).toBe('small_truck');
  });
});
