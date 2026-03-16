import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PlanRouteRequest } from '@adventure/contracts';
import type { ScoreInputSegment } from '@adventure/scoring';
import type { RawRouteCandidate, RoutingProvider } from './types';

interface GraphHopperPath {
  distance: number;
  time: number;
  points?: {
    coordinates: [number, number][];
  };
  details?: {
    surface?: unknown[];
    road_class?: unknown[];
  };
}

interface GraphHopperResponse {
  message?: string;
  hints?: unknown;
  paths?: GraphHopperPath[];
}

function buildSurfaceMixFromSegments(segments: ScoreInputSegment[]): RawRouteCandidate['surfaceMix'] {
  if (!segments.length) {
    return {
      pavedPercent: 0,
      gravelPercent: 0,
      dirtPercent: 0,
      unknownPercent: 100
    };
  }

  const totals = { paved: 0, gravel: 0, dirt: 0, unknown: 0 };
  for (const segment of segments) {
    const weight = Math.max(segment.lengthKm, 0.1);
    totals[segment.surface] += weight;
  }

  const total = totals.paved + totals.gravel + totals.dirt + totals.unknown;
  if (total <= 0) {
    return {
      pavedPercent: 0,
      gravelPercent: 0,
      dirtPercent: 0,
      unknownPercent: 100
    };
  }

  const raw = {
    paved: (totals.paved / total) * 100,
    gravel: (totals.gravel / total) * 100,
    dirt: (totals.dirt / total) * 100,
    unknown: (totals.unknown / total) * 100
  };

  const floors = {
    paved: Math.floor(raw.paved),
    gravel: Math.floor(raw.gravel),
    dirt: Math.floor(raw.dirt),
    unknown: Math.floor(raw.unknown)
  };
  let remainder =
    100 - floors.paved - floors.gravel - floors.dirt - floors.unknown;

  const byFractionDesc = [
    { key: 'paved' as const, frac: raw.paved - floors.paved },
    { key: 'gravel' as const, frac: raw.gravel - floors.gravel },
    { key: 'dirt' as const, frac: raw.dirt - floors.dirt },
    { key: 'unknown' as const, frac: raw.unknown - floors.unknown }
  ].sort((a, b) => b.frac - a.frac);

  for (let index = 0; index < byFractionDesc.length && remainder > 0; index += 1) {
    const surface = byFractionDesc[index]?.key;
    if (!surface) {
      continue;
    }
    floors[surface] += 1;
    remainder -= 1;
  }

  return {
    pavedPercent: floors.paved,
    gravelPercent: floors.gravel,
    dirtPercent: floors.dirt,
    unknownPercent: floors.unknown
  };
}

function mapGraphHopperSurface(rawSurface: unknown): ScoreInputSegment['surface'] {
  if (typeof rawSurface !== 'string') {
    return 'unknown';
  }

  const value = rawSurface.toLowerCase().trim();

  if (
    value.includes('gravel') ||
    value.includes('pebblestone') ||
    value.includes('fine_gravel') ||
    value.includes('compacted')
  ) {
    return 'gravel';
  }

  if (
    value.includes('dirt') ||
    value.includes('earth') ||
    value.includes('ground') ||
    value.includes('mud') ||
    value.includes('sand') ||
    value.includes('grass') ||
    value.includes('unpaved')
  ) {
    return 'dirt';
  }

  if (
    value.includes('paved') ||
    value.includes('asphalt') ||
    value.includes('concrete') ||
    value.includes('sett') ||
    value.includes('cobblestone') ||
    value.includes('paving_stones')
  ) {
    return 'paved';
  }

  return 'unknown';
}

function mapGraphHopperRoadClass(rawRoadClass: string): ScoreInputSegment['roadClass'] {
  if (typeof rawRoadClass !== 'string') {
    return 'tertiary';
  }

  const value = rawRoadClass.toLowerCase().trim();
  if (value.includes('motorway') || value.includes('trunk')) return 'highway';
  if (value.includes('primary')) return 'primary';
  if (value.includes('secondary')) return 'secondary';
  if (value.includes('track') || value.includes('path')) return 'track';
  if (value.includes('tertiary') || value.includes('residential')) return 'tertiary';
  return 'tertiary';
}

function extractHintStrings(hints: unknown): string[] {
  const values: string[] = [];

  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      values.push(value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        visit(item);
      });
      return;
    }

    if (value && typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach((item) => {
        visit(item);
      });
    }
  };

  visit(hints);
  return values;
}

function isUnsupportedPathDetailsError(payload: GraphHopperResponse): boolean {
  const message = (payload.message ?? '').toLowerCase();
  if (message.includes('cannot find the path details')) {
    return true;
  }

  return extractHintStrings(payload.hints).some((value) =>
    value.toLowerCase().includes('cannot find the path details')
  );
}

function buildGraphHopperErrorMessage(payload: GraphHopperResponse, status: number): string {
  if (payload.message) {
    return `${payload.message} (status ${status})`;
  }

  const hint = extractHintStrings(payload.hints).find((value) => value.trim().length > 0);
  if (hint) {
    return `${hint} (status ${status})`;
  }

  return `GraphHopper request failed (${status})`;
}

function parseDetailEntry(
  entry: unknown,
  maxEdgeIndex: number
): { value: string; from: number; to: number } | null {
  if (!Array.isArray(entry) || entry.length < 3) {
    return null;
  }

  const first = entry[0];
  const second = entry[1];
  const third = entry[2];

  let fromRaw: unknown;
  let toRaw: unknown;
  let valueRaw: unknown;

  if (typeof first === 'number' && typeof second === 'number') {
    // GraphHopper detail format often uses [from, to, value]
    fromRaw = first;
    toRaw = second;
    valueRaw = third;
  } else {
    // Backward-compatible fallback for [value, from, to]
    valueRaw = first;
    fromRaw = second;
    toRaw = third;
  }

  if (typeof valueRaw !== 'string') {
    return null;
  }

  if (typeof fromRaw !== 'number' || typeof toRaw !== 'number') {
    return null;
  }

  const from = Math.max(0, Math.min(maxEdgeIndex, Math.floor(fromRaw)));
  const to = Math.max(0, Math.min(maxEdgeIndex, Math.floor(toRaw)));

  if (!valueRaw || Number.isNaN(from) || Number.isNaN(to) || to <= from) {
    return null;
  }

  return { value: valueRaw, from, to };
}

function buildSegmentsFromPathDetails(
  path: GraphHopperPath,
  index: number
): ScoreInputSegment[] {
  const coordinates = path.points?.coordinates ?? [];
  const edgeCount = Math.max(coordinates.length - 1, 1);
  const totalDistanceKm = Math.max(path.distance / 1000, 1);
  const roadClassDetails = Array.isArray(path.details?.road_class) ? path.details.road_class : [];
  const surfaceDetails = Array.isArray(path.details?.surface) ? path.details.surface : [];

  if (!surfaceDetails.length) {
    return [
      {
        lengthKm: totalDistanceKm,
        curvature: 58 + index * 6,
        roadClass: (() => {
          const parsed = parseDetailEntry(roadClassDetails[0], edgeCount);
          return parsed ? mapGraphHopperRoadClass(parsed.value) : 'tertiary';
        })(),
        surface: 'unknown',
        technicalDifficulty: 30
      }
    ];
  }

  const segments: ScoreInputSegment[] = [];

  for (const rawEntry of surfaceDetails) {
    const parsed = parseDetailEntry(rawEntry, edgeCount);
    if (!parsed) {
      continue;
    }

    const spanEdges = Math.max(parsed.to - parsed.from, 1);
    const lengthKm = Math.max((spanEdges / edgeCount) * totalDistanceKm, 0.2);
    const surface = mapGraphHopperSurface(parsed.value);

    const matchedRoadClass = roadClassDetails.find((entry) => {
      const roadParsed = parseDetailEntry(entry, edgeCount);
      if (!roadParsed) return false;
      return roadParsed.from <= parsed.from && roadParsed.to >= parsed.to;
    });

    const roadClass = matchedRoadClass
      ? mapGraphHopperRoadClass(parseDetailEntry(matchedRoadClass, edgeCount)?.value ?? 'tertiary')
      : 'tertiary';
    const surfaceDifficultyBoost = surface === 'dirt' ? 20 : surface === 'gravel' ? 10 : 0;
    const curvatureBoost = surface === 'dirt' ? 8 : surface === 'gravel' ? 4 : 0;

    const previous = segments[segments.length - 1];
    if (previous && previous.surface === surface && previous.roadClass === roadClass) {
      previous.lengthKm += lengthKm;
      continue;
    }

    segments.push({
      lengthKm,
      curvature: 56 + index * 6 + curvatureBoost,
      roadClass,
      surface,
      technicalDifficulty: 30 + surfaceDifficultyBoost
    });
  }

  if (segments.length > 0) {
    return segments;
  }

  return [
    {
      lengthKm: totalDistanceKm,
      curvature: 58 + index * 6,
      roadClass: 'tertiary',
      surface: 'unknown',
      technicalDifficulty: 30
    }
  ];
}

@Injectable()
export class GraphHopperRoutingProvider implements RoutingProvider {
  private readonly baseUrl: string;
  private readonly profile: string;
  private readonly apiKey: string;
  private httpFetch: typeof fetch;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    this.httpFetch = fetch;
    this.baseUrl =
      this.configService?.get<string>('GRAPHHOPPER_BASE_URL', 'http://localhost:8989') ??
      'http://localhost:8989';
    this.profile = this.configService?.get<string>('GRAPHHOPPER_PROFILE', 'car') ?? 'car';
    this.apiKey = this.configService?.get<string>('GRAPHHOPPER_API_KEY', '') ?? '';
  }

  setHttpFetchForTesting(httpFetch: typeof fetch): void {
    this.httpFetch = httpFetch;
  }

  private mapVehicleTypeToProfile(vehicleType: PlanRouteRequest['vehicleType']): string {
    const resolveProfile = (configuredProfile: string | undefined): string => {
      const candidate = configuredProfile?.trim() || this.profile;
      if (!candidate) {
        throw new Error(`No GraphHopper profile configured for vehicleType "${vehicleType}"`);
      }
      return candidate;
    };

    switch (vehicleType) {
      case 'motorcycle':
        return resolveProfile(this.configService.get<string>('GRAPHHOPPER_PROFILE_MOTORCYCLE', this.profile));
      case 'adv_motorcycle':
        return resolveProfile(this.configService.get<string>('GRAPHHOPPER_PROFILE_ADV_MOTORCYCLE', this.profile));
      case '4x4':
        return resolveProfile(this.configService.get<string>('GRAPHHOPPER_PROFILE_4X4', this.profile));
      default:
        throw new Error(`Unsupported vehicleType for GraphHopper profile mapping: ${vehicleType}`);
    }
  }

  async planCandidates(input: PlanRouteRequest): Promise<RawRouteCandidate[]> {
    const isLoopRequest = input.loopRide || !input.end;
    const endPoint = input.end ?? input.start;
    const profile = this.mapVehicleTypeToProfile(input.vehicleType);

    const detailStrategies: string[][] = [
      ['surface', 'road_class'],
      ['road_class'],
      []
    ];

    let payload: GraphHopperResponse | null = null;
    let requestUrl = '';
    let lastFailureMessage = 'GraphHopper returned no route paths';

    for (const details of detailStrategies) {
      const query = new URLSearchParams({
        profile,
        points_encoded: 'false',
        instructions: 'false',
        'ch.disable': 'true'
      });

      if (isLoopRequest) {
        query.set('algorithm', 'round_trip');
        query.set('round_trip.distance', '100000');
        query.set('round_trip.seed', '73');
      } else {
        query.set('algorithm', 'alternative_route');
        query.set('alternative_route.max_paths', '3');
        query.set('alternative_route.max_weight_factor', '2');
        query.set('alternative_route.max_share_factor', '0.8');
        query.set('alternative_route.min_plateau_factor', '0.1');
      }

      for (const detail of details) {
        query.append('details', detail);
      }

      query.append('point', `${input.start.lat},${input.start.lng}`);
      if (!isLoopRequest) {
        query.append('point', `${endPoint.lat},${endPoint.lng}`);
      }

      if (this.apiKey) {
        query.set('key', this.apiKey);
      }

      requestUrl = `${this.baseUrl}/route?${query.toString()}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      let response: Response;
      try {
        response = await this.httpFetch(requestUrl, { signal: controller.signal });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('GraphHopper request timed out after 10000ms');
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }

      let parsedPayload: GraphHopperResponse = {};
      try {
        parsedPayload = (await response.json()) as GraphHopperResponse;
      } catch {
        parsedPayload = {};
      }

      if (isUnsupportedPathDetailsError(parsedPayload) && details.length > 0) {
        lastFailureMessage = `GraphHopper does not support requested details (${details.join(', ')}), retrying`;
        continue;
      }

      if (!response.ok) {
        throw new Error(buildGraphHopperErrorMessage(parsedPayload, response.status));
      }

      if (parsedPayload.paths?.length) {
        payload = parsedPayload;
        break;
      }

      if (parsedPayload.message) {
        throw new Error(buildGraphHopperErrorMessage(parsedPayload, response.status));
      }

      lastFailureMessage = 'GraphHopper returned no route paths';
    }

    if (!payload?.paths?.length) {
      throw new Error(lastFailureMessage);
    }

    return payload.paths.slice(0, 3).map((path, index) => {
      const geometry = path.points?.coordinates ?? [
        [input.start.lng, input.start.lat],
        [endPoint.lng, endPoint.lat]
      ];
      const segments = buildSegmentsFromPathDetails(path, index);
      const surfaceMix = buildSurfaceMixFromSegments(segments);

      const sourceUrl = new URL(requestUrl);
      sourceUrl.search = '';

      return {
        label: index === 0 ? 'Primary Adventure' : `Alternative ${index}`,
        distanceKm: path.distance / 1000,
        durationMin: path.time / 1000 / 60,
        geometry: {
          type: 'LineString',
          coordinates: geometry
        },
        surfaceMix,
        segments,
        providerMeta: {
          provider: 'graphhopper',
          profile,
          source: sourceUrl.toString(),
          hasSurfaceDetails: Boolean(path.details?.surface?.length),
          // TODO: map sliders to GraphHopper custom_model for route personalization.
          // TODO: improve alternative route generation strategy (distance/time diversity constraints).
          // TODO: support region-aware OSM extract switching and periodic refresh jobs.
        }
      };
    });
  }
}
