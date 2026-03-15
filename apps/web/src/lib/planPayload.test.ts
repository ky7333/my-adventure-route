import { describe, expect, it } from 'vitest';
import { toPlanRoutePayload } from './planPayload';

describe('toPlanRoutePayload', () => {
  it('builds point-to-point payload', () => {
    const payload = toPlanRoutePayload({
      startLabel: 'Start',
      startLat: '44.4',
      startLng: '-72.7',
      endLabel: 'End',
      endLat: '44.8',
      endLng: '-72.1',
      loopRide: false,
      vehicleType: 'adv_motorcycle',
      preferences: {
        curvy: 70,
        scenic: 75,
        avoidHighways: 80,
        unpavedPreference: 45,
        difficulty: 50
      }
    });

    expect(payload.end?.lat).toBe(44.8);
    expect(payload.loopRide).toBe(false);
  });

  it('omits end for loop routes', () => {
    const payload = toPlanRoutePayload({
      startLabel: 'Start',
      startLat: '44.4',
      startLng: '-72.7',
      endLabel: '',
      endLat: '',
      endLng: '',
      loopRide: true,
      vehicleType: '4x4',
      preferences: {
        curvy: 60,
        scenic: 65,
        avoidHighways: 70,
        unpavedPreference: 55,
        difficulty: 55
      }
    });

    expect(payload.end).toBeUndefined();
  });
});
