import type { PlanRouteRequest, RoutePreferences, VehicleType } from '@adventure/contracts';

export interface PlanFormValues {
  startLabel: string;
  startLat: string;
  startLng: string;
  endLabel: string;
  endLat: string;
  endLng: string;
  loopRide: boolean;
  vehicleType: VehicleType;
  preferences: RoutePreferences;
}

function parseCoordinate(value: string, field: string): number {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} is required`);
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${field} must be a valid number`);
  }

  return parsed;
}

export function toPlanRoutePayload(values: PlanFormValues): PlanRouteRequest {
  const basePayload: PlanRouteRequest = {
    start: {
      label: values.startLabel,
      lat: parseCoordinate(values.startLat, 'startLat'),
      lng: parseCoordinate(values.startLng, 'startLng')
    },
    loopRide: values.loopRide,
    vehicleType: values.vehicleType,
    preferences: values.preferences
  };

  if (values.loopRide) {
    return basePayload;
  }

  return {
    ...basePayload,
    end: {
      label: values.endLabel,
      lat: parseCoordinate(values.endLat, 'endLat'),
      lng: parseCoordinate(values.endLng, 'endLng')
    }
  };
}
