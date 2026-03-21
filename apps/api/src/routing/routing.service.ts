import { Injectable, Logger } from '@nestjs/common';
import type { PlanRouteRequest } from '@adventure/contracts';
import { MockRoutingProvider } from './mock-routing.provider';
import type { RawRouteCandidate, RoutingProvider } from './types';

const TARGET_CANDIDATE_COUNT = 3;
type DerivedFlavor = 'faster' | 'curvier';

function createGeometrySignature(coordinates: [number, number][]): string {
  return coordinates
    .map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`)
    .join('|');
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function simplifyCoordinates(
  coordinates: [number, number][],
  step: number
): [number, number][] {
  if (step <= 1 || coordinates.length <= 5) {
    return coordinates;
  }

  const lastIndex = coordinates.length - 1;
  return coordinates.filter((_, index) => index === 0 || index === lastIndex || index % step === 0);
}

function buildDerivedSegments(source: RawRouteCandidate, flavor: DerivedFlavor) {
  const curvatureDelta = flavor === 'faster' ? -8 : 14;
  const difficultyDelta = flavor === 'faster' ? -5 : 9;

  return source.segments.map((segment, index) => ({
    ...segment,
    curvature: clampPercent(segment.curvature + curvatureDelta - index * 2),
    technicalDifficulty: clampPercent(segment.technicalDifficulty + difficultyDelta - index)
  }));
}

function deriveGeometry(
  sourceCoordinates: [number, number][],
  variantIndex: number,
  flavor: DerivedFlavor
): [number, number][] | null {
  if (sourceCoordinates.length < 4) {
    return null;
  }

  const lngValues = sourceCoordinates.map(([lng]) => lng);
  const latValues = sourceCoordinates.map(([, lat]) => lat);
  const lngSpan = Math.max(...lngValues) - Math.min(...lngValues);
  const latSpan = Math.max(...latValues) - Math.min(...latValues);
  const baseOffset = Math.max((Math.max(lngSpan, latSpan) || 0.02) * 0.025, 0.0008);
  const variantDirection = variantIndex % 2 === 0 ? 1 : -1;
  const flavorScale = flavor === 'faster' ? 0.5 : 1.6;
  const variantScale = (variantIndex + 1) * 0.8 * flavorScale;
  const waveCycles = flavor === 'faster' ? 1 : 2.4;

  const perturbed: [number, number][] = sourceCoordinates.map(
    ([lng, lat], index, all): [number, number] => {
    if (index === 0 || index === all.length - 1) {
      return [lng, lat];
    }

    const [prevLng, prevLat] = all[index - 1]!;
    const [nextLng, nextLat] = all[index + 1]!;
    const dirLng = nextLng - prevLng;
    const dirLat = nextLat - prevLat;
    const magnitude = Math.hypot(dirLng, dirLat);

    if (magnitude < 1e-9) {
      return [lng, lat];
    }

    const normalLng = (-dirLat / magnitude) * variantDirection;
    const normalLat = (dirLng / magnitude) * variantDirection;
    const wave =
      Math.sin((index / (all.length - 1)) * Math.PI * (variantIndex + 2) * waveCycles) *
      (flavor === 'curvier' ? 1 : 0.75);
    const offset = baseOffset * variantScale * wave;

    return [lng + normalLng * offset, lat + normalLat * offset];
    }
  );

  return simplifyCoordinates(perturbed, flavor === 'faster' ? 2 : 1);
}

function getFlavorForRank(rank: number): DerivedFlavor {
  return rank === 2 ? 'faster' : 'curvier';
}

function isRoadAwarePrimaryCandidate(candidate: RawRouteCandidate): boolean {
  const provider = candidate.providerMeta?.provider;
  return typeof provider === 'string' && provider.toLowerCase() !== 'mock';
}

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(
    private readonly mockProvider: MockRoutingProvider,
    private readonly provider: RoutingProvider
  ) {}

  async planCandidates(input: PlanRouteRequest): Promise<RawRouteCandidate[]> {
    const primaryCandidates = await this.tryPrimaryProvider(input);

    if (primaryCandidates.length >= TARGET_CANDIDATE_COUNT) {
      return primaryCandidates.slice(0, TARGET_CANDIDATE_COUNT);
    }

    // Keep real provider geometries intact. Synthetic geometry perturbations can drift off-road.
    if (primaryCandidates.length > 0 && primaryCandidates.every(isRoadAwarePrimaryCandidate)) {
      return primaryCandidates;
    }

    const derivedCandidates = this.deriveAlternatives(primaryCandidates);
    const fallbackCandidates = await this.mockProvider.planCandidates(input);
    const merged = [...primaryCandidates, ...derivedCandidates];
    const seenGeometry = new Set(
      merged.map((candidate) => createGeometrySignature(candidate.geometry.coordinates))
    );

    for (const candidate of fallbackCandidates) {
      if (merged.length >= TARGET_CANDIDATE_COUNT) break;
      const signature = createGeometrySignature(candidate.geometry.coordinates);
      if (seenGeometry.has(signature)) {
        continue;
      }
      merged.push({
        ...candidate,
        label: `${candidate.label} (Fallback)`
      });
      seenGeometry.add(signature);
    }

    return merged.slice(0, TARGET_CANDIDATE_COUNT);
  }

  private async tryPrimaryProvider(input: PlanRouteRequest): Promise<RawRouteCandidate[]> {
    try {
      return await this.provider.planCandidates(input);
    } catch (error) {
      this.logger.warn(`Routing provider failed, using mock fallback: ${(error as Error).message}`);
      return [];
    }
  }

  private deriveAlternatives(primaryCandidates: RawRouteCandidate[]): RawRouteCandidate[] {
    if (!primaryCandidates.length) {
      return [];
    }

    const derivedCandidates: RawRouteCandidate[] = [];
    const seenGeometry = new Set(
      primaryCandidates.map((candidate) => createGeometrySignature(candidate.geometry.coordinates))
    );

    for (let variantIndex = 0; variantIndex < TARGET_CANDIDATE_COUNT * 2; variantIndex += 1) {
      if (primaryCandidates.length + derivedCandidates.length >= TARGET_CANDIDATE_COUNT) {
        break;
      }

      const sourceCandidate = primaryCandidates[variantIndex % primaryCandidates.length];
      if (!sourceCandidate) {
        continue;
      }
      const rank = primaryCandidates.length + derivedCandidates.length + 1;
      const flavor = getFlavorForRank(rank);
      const coordinates = deriveGeometry(sourceCandidate.geometry.coordinates, variantIndex, flavor);
      if (!coordinates) {
        continue;
      }

      const signature = createGeometrySignature(coordinates);
      if (seenGeometry.has(signature)) {
        continue;
      }

      derivedCandidates.push({
        ...sourceCandidate,
        label: `Alternative ${rank} (${flavor === 'faster' ? 'Faster' : 'Curvier'})`,
        distanceKm:
          sourceCandidate.distanceKm * (flavor === 'faster' ? 0.94 : 1 + (variantIndex + 1) * 0.05),
        durationMin:
          sourceCandidate.durationMin * (flavor === 'faster' ? 0.9 : 1 + (variantIndex + 1) * 0.07),
        geometry: {
          type: 'LineString',
          coordinates
        },
        segments: buildDerivedSegments(sourceCandidate, flavor),
        providerMeta: {
          ...sourceCandidate.providerMeta,
          derivedFrom: sourceCandidate.label,
          variation: variantIndex + 1,
          strategy: flavor
        }
      });

      seenGeometry.add(signature);
    }

    return derivedCandidates;
  }
}
