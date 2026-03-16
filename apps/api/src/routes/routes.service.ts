import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  locationInputSchema,
  planRouteResponseSchema,
  routeDetailResponseSchema,
  routeSurfaceSectionsSchema,
  type PlanRouteRequest,
  type PlanRouteResponse,
  type RouteAlternative,
  type RouteDetailResponse,
  type RouteSurfaceSection,
  type RouteSurfaceType,
  type SurfaceMix
} from '@adventure/contracts';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { RoutingService } from '../routing/routing.service';
import { ScoringService } from '../scoring/scoring.service';
import type { RawRouteCandidate } from '../routing/types';

const SURFACE_KEYS = ['paved', 'gravel', 'dirt', 'unknown'] as const;

function roundSurfacePercents(rawPercents: Record<RouteSurfaceType, number>): SurfaceMix {
  const entries = SURFACE_KEYS.map((surface) => ({
    surface,
    raw: Math.max(0, rawPercents[surface] ?? 0)
  }));
  const rounded: Record<RouteSurfaceType, number> = {
    paved: 0,
    gravel: 0,
    dirt: 0,
    unknown: 0
  };

  let remaining = 100;
  for (const entry of entries) {
    const floored = Math.floor(entry.raw);
    rounded[entry.surface] = floored;
    remaining -= floored;
  }

  if (remaining > 0) {
    const byRemainderDesc = entries
      .map((entry) => ({ ...entry, remainder: entry.raw - Math.floor(entry.raw) }))
      .sort((a, b) => b.remainder - a.remainder);

    for (let i = 0; i < byRemainderDesc.length && remaining > 0; i += 1) {
      const target = byRemainderDesc[i]?.surface;
      if (!target) {
        continue;
      }
      rounded[target] += 1;
      remaining -= 1;
    }
  }

  return {
    pavedPercent: rounded.paved,
    gravelPercent: rounded.gravel,
    dirtPercent: rounded.dirt,
    unknownPercent: rounded.unknown
  };
}

function normalizeSurfaceMix(surfaceMix: SurfaceMix): SurfaceMix {
  const raw = {
    paved: Math.max(0, surfaceMix.pavedPercent),
    gravel: Math.max(0, surfaceMix.gravelPercent),
    dirt: Math.max(0, surfaceMix.dirtPercent),
    unknown: Math.max(0, surfaceMix.unknownPercent)
  };
  const total = raw.paved + raw.gravel + raw.dirt + raw.unknown;

  if (total <= 0) {
    return { pavedPercent: 100, gravelPercent: 0, dirtPercent: 0, unknownPercent: 0 };
  }

  return roundSurfacePercents({
    paved: (raw.paved / total) * 100,
    gravel: (raw.gravel / total) * 100,
    dirt: (raw.dirt / total) * 100,
    unknown: (raw.unknown / total) * 100
  });
}

function calculateSurfaceMix(candidate: RawRouteCandidate): SurfaceMix {
  if (!candidate.segments.length) {
    return normalizeSurfaceMix(candidate.surfaceMix);
  }

  const totals: Record<RouteSurfaceType, number> = {
    paved: 0,
    gravel: 0,
    dirt: 0,
    unknown: 0
  };

  for (const segment of candidate.segments) {
    const weight = Math.max(segment.lengthKm, 0.1);
    totals[segment.surface] += weight;
  }

  const totalWeight = totals.paved + totals.gravel + totals.dirt + totals.unknown;
  if (totalWeight <= 0) {
    return normalizeSurfaceMix(candidate.surfaceMix);
  }

  return roundSurfacePercents({
    paved: (totals.paved / totalWeight) * 100,
    gravel: (totals.gravel / totalWeight) * 100,
    dirt: (totals.dirt / totalWeight) * 100,
    unknown: (totals.unknown / totalWeight) * 100
  });
}

function dominantSurfaceFromMix(surfaceMix: RawRouteCandidate['surfaceMix']): RouteSurfaceType {
  const ranked: Array<{ surface: RouteSurfaceType; value: number }> = [
    { surface: 'paved', value: surfaceMix.pavedPercent },
    { surface: 'gravel', value: surfaceMix.gravelPercent },
    { surface: 'dirt', value: surfaceMix.dirtPercent },
    { surface: 'unknown', value: surfaceMix.unknownPercent }
  ];

  return ranked.sort((a, b) => b.value - a.value)[0]?.surface ?? 'unknown';
}

function buildSurfaceSections(
  candidate: RawRouteCandidate,
  surfaceMixForFallback: SurfaceMix
): RouteSurfaceSection[] {
  const coordinateCount = candidate.geometry.coordinates.length;
  const edgeCount = coordinateCount - 1;

  if (edgeCount <= 0) {
    return [];
  }

  if (!candidate.segments.length) {
    return [
      {
        startCoordinateIndex: 0,
        endCoordinateIndex: edgeCount,
        surface: dominantSurfaceFromMix(surfaceMixForFallback)
      }
    ];
  }

  const segmentWeights = candidate.segments.map((segment) => Math.max(segment.lengthKm, 0.1));
  const totalWeight = segmentWeights.reduce((sum, value) => sum + value, 0);
  const weightedEdges = segmentWeights.map((weight) => (weight / totalWeight) * edgeCount);
  const edgeCounts = weightedEdges.map((value) => Math.floor(value));

  let remainingEdges = edgeCount - edgeCounts.reduce((sum, value) => sum + value, 0);

  if (remainingEdges > 0) {
    const byRemainderDesc = weightedEdges
      .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
      .sort((a, b) => b.remainder - a.remainder);

    for (let i = 0; i < byRemainderDesc.length && remainingEdges > 0; i += 1) {
      const targetIndex = byRemainderDesc[i]?.index;
      if (targetIndex === undefined) {
        continue;
      }
      edgeCounts[targetIndex] = (edgeCounts[targetIndex] ?? 0) + 1;
      remainingEdges -= 1;
    }
  }

  const sections: RouteSurfaceSection[] = [];
  let currentEdgeIndex = 0;

  for (let index = 0; index < candidate.segments.length; index += 1) {
    const segment = candidate.segments[index];
    const allocatedEdges = edgeCounts[index] ?? 0;

    if (!segment || allocatedEdges <= 0) {
      continue;
    }

    const startCoordinateIndex = currentEdgeIndex;
    const endCoordinateIndex = Math.min(edgeCount, currentEdgeIndex + allocatedEdges);
    currentEdgeIndex = endCoordinateIndex;

    if (sections.length > 0) {
      const previous = sections[sections.length - 1];
      if (
        previous &&
        previous.surface === segment.surface &&
        previous.endCoordinateIndex === startCoordinateIndex
      ) {
        previous.endCoordinateIndex = endCoordinateIndex;
        continue;
      }
    }

    sections.push({
      startCoordinateIndex,
      endCoordinateIndex,
      surface: segment.surface
    });
  }

  if (sections.length === 0) {
    return [
      {
        startCoordinateIndex: 0,
        endCoordinateIndex: edgeCount,
        surface: dominantSurfaceFromMix(surfaceMixForFallback)
      }
    ];
  }

  const lastSection = sections[sections.length - 1];
  if (lastSection && lastSection.endCoordinateIndex < edgeCount) {
    lastSection.endCoordinateIndex = edgeCount;
  }

  return sections;
}

function readSurfaceSectionsFromProviderMeta(providerMeta: Prisma.JsonValue): RouteSurfaceSection[] | undefined {
  if (!providerMeta || typeof providerMeta !== 'object' || Array.isArray(providerMeta)) {
    return undefined;
  }

  const raw = (providerMeta as Record<string, unknown>).surfaceSections;
  const parsed = routeSurfaceSectionsSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

@Injectable()
export class RoutesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RoutingService) private readonly routingService: RoutingService,
    @Inject(ScoringService) private readonly scoringService: ScoringService
  ) {}

  async planRoute(userId: string, input: PlanRouteRequest): Promise<PlanRouteResponse> {
    const candidates = await this.routingService.planCandidates(input);

    const scoredCandidates = candidates
      .map((candidate) => {
        const score = this.scoringService.scoreCandidate(input.vehicleType, input.preferences, candidate);
        const surfaceMix = calculateSurfaceMix(candidate);
        const surfaceSections = buildSurfaceSections(candidate, surfaceMix);
        return {
          ...candidate,
          surfaceMix,
          score,
          twistinessScore: score.curvature,
          difficultyScore: score.difficulty,
          surfaceSections
        };
      })
      .sort((a, b) => b.score.total - a.score.total)
      .slice(0, 3);

    if (scoredCandidates.length === 0) {
      throw new NotFoundException('No route candidates were generated.');
    }

    const routeRequest = await this.prisma.routeRequest.create({
      data: {
        userId,
        startLabel: input.start.label,
        startLat: input.start.lat,
        startLng: input.start.lng,
        endLabel: input.end?.label ?? null,
        endLat: input.end?.lat ?? null,
        endLng: input.end?.lng ?? null,
        loopRide: input.loopRide,
        vehicleType: input.vehicleType,
        preferences: input.preferences as Prisma.InputJsonValue,
        options: {
          create: scoredCandidates.map((candidate, index) => ({
            rank: index + 1,
            label: candidate.label,
            distanceKm: candidate.distanceKm,
            durationMin: candidate.durationMin,
            surfaceMix: candidate.surfaceMix as Prisma.InputJsonValue,
            twistinessScore: candidate.twistinessScore,
            difficultyScore: candidate.difficultyScore,
            score: candidate.score as unknown as Prisma.InputJsonValue,
            geometry: candidate.geometry as Prisma.InputJsonValue,
            providerMeta: {
              ...candidate.providerMeta,
              surfaceSections: candidate.surfaceSections
            } as Prisma.InputJsonValue
          }))
        }
      },
      include: {
        options: {
          orderBy: {
            rank: 'asc'
          }
        }
      }
    });

    const responseOptions: RouteAlternative[] = routeRequest.options.map((option) => ({
      id: option.id,
      rank: option.rank,
      label: option.label,
      distanceKm: option.distanceKm,
      durationMin: option.durationMin,
      twistinessScore: option.twistinessScore,
      difficultyScore: option.difficultyScore,
      surfaceMix: normalizeSurfaceMix(option.surfaceMix as RouteAlternative['surfaceMix']),
      score: option.score as RouteAlternative['score'],
      geometry: option.geometry as RouteAlternative['geometry'],
      surfaceSections: readSurfaceSectionsFromProviderMeta(option.providerMeta)
    }));

    return planRouteResponseSchema.parse({
      routeRequestId: routeRequest.id,
      generatedAt: routeRequest.createdAt.toISOString(),
      options: responseOptions
    });
  }

  async getRouteById(userId: string, routeRequestId: string): Promise<RouteDetailResponse> {
    const routeRequest = await this.prisma.routeRequest.findUnique({
      where: { id: routeRequestId },
      include: {
        options: {
          orderBy: {
            rank: 'asc'
          }
        }
      }
    });

    if (!routeRequest) {
      throw new NotFoundException('Route request not found');
    }

    if (routeRequest.userId !== userId) {
      throw new ForbiddenException('Route request does not belong to user');
    }

    const hasCompleteEndLocation =
      routeRequest.endLabel !== null && routeRequest.endLat !== null && routeRequest.endLng !== null;
    const parsedEndLocation = hasCompleteEndLocation
      ? locationInputSchema.safeParse({
          label: routeRequest.endLabel,
          lat: routeRequest.endLat,
          lng: routeRequest.endLng
        })
      : null;

    return routeDetailResponseSchema.parse({
      routeRequestId: routeRequest.id,
      userId: routeRequest.userId,
      start: {
        label: routeRequest.startLabel,
        lat: routeRequest.startLat,
        lng: routeRequest.startLng
      },
      end: parsedEndLocation?.success ? parsedEndLocation.data : null,
      loopRide: routeRequest.loopRide,
      vehicleType: routeRequest.vehicleType,
      preferences: routeRequest.preferences,
      options: routeRequest.options.map((option) => ({
        id: option.id,
        rank: option.rank,
        label: option.label,
        distanceKm: option.distanceKm,
        durationMin: option.durationMin,
        twistinessScore: option.twistinessScore,
        difficultyScore: option.difficultyScore,
        surfaceMix: normalizeSurfaceMix(option.surfaceMix as RouteAlternative['surfaceMix']),
        score: option.score,
        geometry: option.geometry,
        surfaceSections: readSurfaceSectionsFromProviderMeta(option.providerMeta)
      }))
    });
  }
}
