import type { RoutePreferences, VehicleType } from '@adventure/contracts';

export type ScoreComponent = 'curvature' | 'roadClass' | 'surface' | 'difficulty';

export interface ScoreInputSegment {
  lengthKm: number;
  curvature: number;
  roadClass: 'highway' | 'primary' | 'secondary' | 'tertiary' | 'track';
  surface: 'paved' | 'gravel' | 'dirt' | 'unknown';
  technicalDifficulty: number;
}

export interface DifficultyProfile {
  baseTolerance: number;
  offroadBias: number;
}

export interface RouteScoreBreakdown {
  curvature: number;
  roadClass: number;
  surface: number;
  difficulty: number;
  total: number;
}

export interface ScoringInput {
  vehicleType: VehicleType;
  preferences: RoutePreferences;
  segments: ScoreInputSegment[];
}

export interface RouteScoringEngine {
  scoreRoute(input: ScoringInput): RouteScoreBreakdown;
}

const VEHICLE_PROFILES: Record<VehicleType, DifficultyProfile> = {
  motorcycle: { baseTolerance: 40, offroadBias: 20 },
  adv_motorcycle: { baseTolerance: 60, offroadBias: 55 },
  '4x4': { baseTolerance: 75, offroadBias: 70 }
};

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weightedAverage(
  segments: ScoreInputSegment[],
  valueSelector: (segment: ScoreInputSegment) => number
): number {
  if (segments.length === 0) {
    return 0;
  }

  const totalLengthKm = segments.reduce((sum, segment) => sum + Math.max(segment.lengthKm, 0), 0);
  if (totalLengthKm <= 0) {
    return average(segments.map(valueSelector));
  }

  const weightedSum = segments.reduce(
    (sum, segment) => sum + valueSelector(segment) * Math.max(segment.lengthKm, 0),
    0
  );
  return weightedSum / totalLengthKm;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function roadClassScore(roadClass: ScoreInputSegment['roadClass']): number {
  switch (roadClass) {
    case 'highway':
      return 10;
    case 'primary':
      return 35;
    case 'secondary':
      return 60;
    case 'tertiary':
      return 80;
    case 'track':
      return 90;
  }
}

function surfaceScore(surface: ScoreInputSegment['surface']): number {
  switch (surface) {
    case 'paved':
      return 45;
    case 'gravel':
      return 75;
    case 'dirt':
      return 85;
    case 'unknown':
      return 50;
  }
}

export class DefaultRouteScoringEngine implements RouteScoringEngine {
  scoreRoute(input: ScoringInput): RouteScoreBreakdown {
    const profile = VEHICLE_PROFILES[input.vehicleType];

    const curvature = weightedAverage(input.segments, (segment) => segment.curvature);
    const roadClass = weightedAverage(input.segments, (segment) => roadClassScore(segment.roadClass));
    const surface = weightedAverage(input.segments, (segment) => surfaceScore(segment.surface));
    const rawDifficulty = weightedAverage(input.segments, (segment) => segment.technicalDifficulty);

    const difficultyPreference = input.preferences.difficulty;
    const toleranceBoost = (profile.baseTolerance + profile.offroadBias) / 2;
    const targetDifficulty = clamp((difficultyPreference + toleranceBoost) / 2);
    const difficulty = clamp(100 - Math.abs(targetDifficulty - rawDifficulty));

    const c1 = 0.35 + input.preferences.curvy / 400;
    const c2 = 0.25 + input.preferences.avoidHighways / 500;
    const c3 = 0.2 + input.preferences.unpavedPreference / 500;
    const c4 = 0.2 + input.preferences.difficulty / 500;
    const weightsSum = c1 + c2 + c3 + c4;
    const total = clamp((curvature * c1 + roadClass * c2 + surface * c3 + difficulty * c4) / (weightsSum || 1));

    return {
      curvature: clamp(curvature),
      roadClass: clamp(roadClass),
      surface: clamp(surface),
      difficulty: clamp(difficulty),
      total
    };
  }
}
