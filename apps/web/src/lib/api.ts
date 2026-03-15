import {
  authResponseSchema,
  planRouteResponseSchema,
  routeDetailResponseSchema,
  type AuthLoginRequest,
  type AuthRegisterRequest,
  type PlanRouteRequest,
  type PlanRouteResponse,
  type RouteDetailResponse
} from '@adventure/contracts';
import { getAccessToken } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

async function apiRequest<T>(path: string, init: RequestInit, parser: (payload: unknown) => T): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {})
    }
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload && 'message' in payload
        ? String((payload as Record<string, unknown>).message)
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return parser(payload);
}

export async function register(input: AuthRegisterRequest) {
  return apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(input) }, (payload) =>
    authResponseSchema.parse(payload)
  );
}

export async function login(input: AuthLoginRequest) {
  return apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(input) }, (payload) =>
    authResponseSchema.parse(payload)
  );
}

export async function planRoute(input: PlanRouteRequest): Promise<PlanRouteResponse> {
  return apiRequest('/routes/plan', { method: 'POST', body: JSON.stringify(input) }, (payload) =>
    planRouteResponseSchema.parse(payload)
  );
}

export async function fetchRoute(routeRequestId: string): Promise<RouteDetailResponse> {
  return apiRequest(`/routes/${routeRequestId}`, { method: 'GET' }, (payload) =>
    routeDetailResponseSchema.parse(payload)
  );
}
