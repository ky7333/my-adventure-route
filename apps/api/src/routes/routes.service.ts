import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  geocodeSearchResponseSchema,
  locationInputSchema,
  planRouteResponseSchema,
  routeDetailResponseSchema,
  routeSurfaceSectionsSchema,
  type GeocodeHit,
  type GeocodeSearchResponse,
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

interface PhotonFeatureProperties {
  name?: string;
  street?: string;
  housenumber?: string;
  city?: string;
  state?: string;
  country?: string;
  postcode?: string;
}

interface PhotonFeature {
  geometry?: {
    coordinates?: unknown;
  };
  properties?: PhotonFeatureProperties;
}

interface PhotonGeocodeResponse {
  features?: PhotonFeature[];
}

function parseNumericCoordinate(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function joinLabelParts(parts: string[], fallback: string): string {
  const unique = new Set<string>();
  const cleanedParts = parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .filter((part) => {
      const normalized = part.toLowerCase();
      if (unique.has(normalized)) {
        return false;
      }
      unique.add(normalized);
      return true;
    });

  return cleanedParts.length > 0 ? cleanedParts.join(', ') : fallback;
}

function buildPhotonLabel(properties: PhotonFeatureProperties | undefined, fallback: string): string {
  const streetLine = [properties?.street ?? '', properties?.housenumber ?? '']
    .join(' ')
    .trim();
  return joinLabelParts(
    [properties?.name ?? '', streetLine, properties?.city ?? '', properties?.state ?? '', properties?.country ?? '', properties?.postcode ?? ''],
    fallback
  );
}

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
    return { pavedPercent: 0, gravelPercent: 0, dirtPercent: 0, unknownPercent: 100 };
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

function getUnpavedPercent(surfaceMix: SurfaceMix): number {
  return surfaceMix.gravelPercent + surfaceMix.dirtPercent;
}

function selectTopCandidatesWithDiversity(
  candidates: Array<
    RawRouteCandidate & {
      surfaceMix: SurfaceMix;
      score: RouteAlternative['score'];
      twistinessScore: number;
      difficultyScore: number;
      surfaceSections: RouteSurfaceSection[];
    }
  >,
  preferences: PlanRouteRequest['preferences']
): Array<
  RawRouteCandidate & {
    surfaceMix: SurfaceMix;
    score: RouteAlternative['score'];
    twistinessScore: number;
    difficultyScore: number;
    surfaceSections: RouteSurfaceSection[];
  }
> {
  const providerOrderedCandidates = candidates.every((candidate) => {
    const provider = (candidate.providerMeta as Record<string, unknown> | undefined)?.provider;
    return typeof provider === 'string' && provider.toLowerCase() === 'graphhopper';
  });

  const sortedByScore = [...candidates].sort((a, b) => b.score.total - a.score.total);
  if (sortedByScore.length <= 3) {
    return providerOrderedCandidates ? candidates : sortedByScore;
  }

  const selected: typeof sortedByScore = [];
  const primary = sortedByScore[0];
  if (!primary) {
    return [];
  }
  selected.push(primary);

  const remaining = sortedByScore.slice(1);
  const highestUnpaved = [...remaining].sort((a, b) => {
    const unpavedDiff = getUnpavedPercent(b.surfaceMix) - getUnpavedPercent(a.surfaceMix);
    if (unpavedDiff !== 0) {
      return unpavedDiff;
    }
    return b.score.total - a.score.total;
  })[0];

  const primaryUnpaved = getUnpavedPercent(primary.surfaceMix);
  const shouldPromoteUnpaved =
    preferences.unpavedPreference >= 55 ||
    (highestUnpaved ? getUnpavedPercent(highestUnpaved.surfaceMix) - primaryUnpaved >= 10 : false);

  if (shouldPromoteUnpaved && highestUnpaved) {
    selected.push(highestUnpaved);
  }

  for (const candidate of sortedByScore) {
    if (selected.length >= 3) {
      break;
    }
    if (selected.includes(candidate)) {
      continue;
    }
    selected.push(candidate);
  }

  return selected.slice(0, 3);
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
  private readonly logger = new Logger(RoutesService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RoutingService) private readonly routingService: RoutingService,
    @Inject(ScoringService) private readonly scoringService: ScoringService,
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {}

  async geocodeAddress(query: string, limit = 5): Promise<GeocodeSearchResponse> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      throw new BadRequestException('q is required');
    }

    const hits = await this.searchPhoton(trimmedQuery, limit);
    return geocodeSearchResponseSchema.parse({ hits });
  }

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
      });

    const selectedCandidates = selectTopCandidatesWithDiversity(scoredCandidates, input.preferences);

    if (selectedCandidates.length === 0) {
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
          create: selectedCandidates.map((candidate, index) => ({
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

  private async searchPhoton(query: string, limit: number): Promise<GeocodeHit[]> {
    const photonBaseUrl =
      this.configService.get<string>('PHOTON_BASE_URL', 'https://photon.komoot.io') ??
      'https://photon.komoot.io';
    const endpoint = new URL(`${photonBaseUrl.replace(/\/$/, '')}/api`);
    endpoint.searchParams.set('q', query);
    endpoint.searchParams.set('limit', String(limit));
    endpoint.searchParams.set('lang', 'en');

    let response: Response;
    try {
      response = await fetch(endpoint, {
        headers: {
          Accept: 'application/json'
        }
      });
    } catch (error) {
      this.logger.warn(
        `Photon geocode request failed (${endpoint.origin}): ${(error as Error).message}`
      );
      throw new ServiceUnavailableException('Photon geocoding is unavailable. Please try again.');
    }

    if (!response.ok) {
      this.logger.warn(
        `Photon geocode request returned ${response.status} (${endpoint.origin}).`
      );
      throw new ServiceUnavailableException('Photon geocoding is unavailable. Please try again.');
    }

    const payload = (await response.json().catch(() => ({}))) as PhotonGeocodeResponse;
    const features = Array.isArray(payload.features) ? payload.features : [];
    const hits = features
      .map((feature): GeocodeHit | null => {
        const rawCoordinates = feature.geometry?.coordinates;
        if (!Array.isArray(rawCoordinates) || rawCoordinates.length < 2) {
          return null;
        }

        const lng = parseNumericCoordinate(rawCoordinates[0]);
        const lat = parseNumericCoordinate(rawCoordinates[1]);
        if (lat === null || lng === null) {
          return null;
        }

        return {
          label: buildPhotonLabel(feature.properties, query),
          lat,
          lng
        };
      })
      .filter((hit): hit is GeocodeHit => hit !== null);

    const uniqueHits = new Map<string, GeocodeHit>();
    for (const hit of hits) {
      const key = `${hit.label.toLowerCase()}|${hit.lat.toFixed(6)}|${hit.lng.toFixed(6)}`;
      if (!uniqueHits.has(key)) {
        uniqueHits.set(key, hit);
      }
    }

    return Array.from(uniqueHits.values()).slice(0, limit);
  }
}
