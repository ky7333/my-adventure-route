import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RoutesController } from '../src/routes/routes.controller';

const mockPlanResponse = {
  routeRequestId: 'rr_1',
  generatedAt: new Date().toISOString(),
  options: [
    {
      id: 'o1',
      rank: 1,
      label: 'Primary Adventure',
      distanceKm: 120,
      durationMin: 180,
      twistinessScore: 78,
      difficultyScore: 55,
      surfaceMix: {
        pavedPercent: 60,
        gravelPercent: 25,
        dirtPercent: 10,
        unknownPercent: 5
      },
      score: {
        curvature: 70,
        roadClass: 65,
        surface: 60,
        difficulty: 58,
        total: 72
      },
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [-72.7, 44.4],
          [-72.1, 44.8]
        ]
      }
    },
    {
      id: 'o2',
      rank: 2,
      label: 'Alternative 1',
      distanceKm: 130,
      durationMin: 195,
      twistinessScore: 74,
      difficultyScore: 62,
      surfaceMix: {
        pavedPercent: 45,
        gravelPercent: 35,
        dirtPercent: 15,
        unknownPercent: 5
      },
      score: {
        curvature: 68,
        roadClass: 67,
        surface: 72,
        difficulty: 61,
        total: 70
      },
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [-72.7, 44.4],
          [-72.3, 44.9]
        ]
      }
    },
    {
      id: 'o3',
      rank: 3,
      label: 'Alternative 2',
      distanceKm: 140,
      durationMin: 210,
      twistinessScore: 69,
      difficultyScore: 64,
      surfaceMix: {
        pavedPercent: 35,
        gravelPercent: 40,
        dirtPercent: 20,
        unknownPercent: 5
      },
      score: {
        curvature: 66,
        roadClass: 70,
        surface: 77,
        difficulty: 63,
        total: 68
      },
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [-72.7, 44.4],
          [-72, 44.7]
        ]
      }
    }
  ]
};

describe('RoutesController (integration)', () => {
  it('declares auth guard for route planning access', () => {
    const classGuards = Reflect.getMetadata(GUARDS_METADATA, RoutesController) as unknown[];
    expect(classGuards).toContain(JwtAuthGuard);
  });

  it('accepts valid planning payloads and returns 3 options', async () => {
    const routesService = {
      planRoute: vi.fn().mockResolvedValue(mockPlanResponse),
      getRouteById: vi.fn()
    };

    const controller = new RoutesController(routesService as any);

    const result = await controller.planRoute(
      {
        user: {
          userId: 'user_1',
          email: 'user@example.com'
        }
      } as any,
      {
        start: { label: 'A', lat: 44.4, lng: -72.7 },
        end: { label: 'B', lat: 44.8, lng: -72.1 },
        loopRide: false,
        vehicleType: 'motorcycle',
        preferences: {
          curvy: 90,
          scenic: 70,
          avoidHighways: 80,
          unpavedPreference: 60,
          difficulty: 50
        }
      }
    );

    expect(routesService.planRoute).toHaveBeenCalledWith(
      'user_1',
      expect.objectContaining({ vehicleType: 'motorcycle' })
    );
    expect(result.options).toHaveLength(3);
  });

  it('rejects invalid planning payloads', async () => {
    const routesService = {
      planRoute: vi.fn(),
      getRouteById: vi.fn()
    };

    const controller = new RoutesController(routesService as any);

    await expect(controller.planRoute({ user: { userId: 'u1' } } as any, {})).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});
