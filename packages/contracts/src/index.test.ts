import { describe, expect, it } from 'vitest';
import { planRouteRequestSchema } from './index';

describe('planRouteRequestSchema', () => {
  it('rejects point-to-point route without end location', () => {
    const parsed = planRouteRequestSchema.safeParse({
      start: { label: 'A', lat: 44.4, lng: -72.7 },
      loopRide: false,
      vehicleType: 'motorcycle',
      preferences: {
        curvy: 50,
        scenic: 50,
        avoidHighways: 50,
        unpavedPreference: 50,
        difficulty: 50
      }
    });

    expect(parsed.success).toBe(false);
  });
});
