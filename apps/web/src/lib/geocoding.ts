export interface GeocodedPoint {
  lat: number;
  lng: number;
}

interface NominatimSearchResult {
  lat?: string;
  lon?: string;
}

function parseCoordinate(value: string | undefined, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${field} returned by geocoding service`);
  }

  return parsed;
}

export async function geocodeAddress(address: string, fieldLabel: string): Promise<GeocodedPoint> {
  const trimmed = address.trim();
  if (!trimmed) {
    throw new Error(`${fieldLabel} is required`);
  }

  const endpoint = new URL('https://nominatim.openstreetmap.org/search');
  endpoint.searchParams.set('format', 'jsonv2');
  endpoint.searchParams.set('limit', '1');
  endpoint.searchParams.set('q', trimmed);

  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'my-adventure-route/1.0 (+https://github.com/ky7333/my-adventure-route)'
    }
  });

  if (!response.ok) {
    throw new Error(`Unable to geocode ${fieldLabel}. Please try again.`);
  }

  const payload = await response.json() as NominatimSearchResult[];
  const firstMatch = payload[0];
  if (!firstMatch) {
    throw new Error(`No location found for ${fieldLabel}. Try a more specific address.`);
  }

  return {
    lat: parseCoordinate(firstMatch.lat, 'latitude'),
    lng: parseCoordinate(firstMatch.lon, 'longitude')
  };
}
