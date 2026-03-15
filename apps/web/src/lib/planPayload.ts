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

export function toPlanRoutePayload(values: PlanFormValues): PlanRouteRequest {
  const basePayload: PlanRouteRequest = {
    start: {
      label: values.startLabel,
      lat: Number(values.startLat),
      lng: Number(values.startLng)
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
      lat: Number(values.endLat),
      lng: Number(values.endLng)
    }
  };
}
