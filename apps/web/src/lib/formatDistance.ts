type DistanceUnit = 'mi' | 'km';

const KM_TO_MILES = 0.621371;

export function formatRouteDistance(distanceKm: number, unit: DistanceUnit = 'mi'): string {
  if (unit === 'km') {
    return `${distanceKm.toFixed(1)} km`;
  }

  const miles = distanceKm * KM_TO_MILES;
  return `${miles.toFixed(1)} mi`;
}
