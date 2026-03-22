import { geocodeSearchResponseSchema } from '@adventure/contracts';
import { getAccessToken } from './auth';

export interface GeocodedPoint {
  lat: number;
  lng: number;
}

export interface GeocodeOption extends GeocodedPoint {
  label: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export async function searchAddressOptions(query: string, limit = 5): Promise<GeocodeOption[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const endpoint = new URL(`${API_BASE_URL}/routes/geocode`, window.location.origin);
  endpoint.searchParams.set('q', trimmedQuery);
  endpoint.searchParams.set('limit', String(limit));
  const token = getAccessToken();

  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload
      ? (Array.isArray(payload.message)
          ? payload.message.map((entry: unknown) => String(entry)).join(', ')
          : String(payload.message))
      : 'Unable to search locations. Please try again.';
    throw new Error(message);
  }

  const parsed = geocodeSearchResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error('Unable to search locations. Please try again.');
  }

  return parsed.data.hits;
}

export async function geocodeAddress(address: string, fieldLabel: string): Promise<GeocodedPoint> {
  const trimmed = address.trim();
  if (!trimmed) {
    throw new Error(`${fieldLabel} is required`);
  }

  const hits = await searchAddressOptions(trimmed, 1);
  const firstHit = hits[0];
  if (!firstHit) {
    throw new Error(`No location found for ${fieldLabel}. Try a more specific address.`);
  }

  return {
    lat: firstHit.lat,
    lng: firstHit.lng
  };
}
