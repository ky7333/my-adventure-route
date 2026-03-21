import { describe, expect, it } from 'vitest';
import { toPlanRoutePayload, type PlanFormValues } from './planPayload';

describe('toPlanRoutePayload', () => {
  const baseValues: PlanFormValues = {
    startLabel: 'Start',
    startLat: '44.4',
    startLng: '-72.7',
    endLabel: 'End',
    endLat: '44.8',
    endLng: '-72.1',
    loopRide: false,
    vehicleType: '4x4' as const,
    preferences: {
      curvy: 60,
      scenic: 65,
      avoidHighways: 70,
      unpavedPreference: 55,
      difficulty: 55,
      distanceInfluence: 18
    }
  };
  const makePlanInput = (overrides: Partial<PlanFormValues> = {}): PlanFormValues => ({
    ...baseValues,
    ...overrides,
    preferences: {
      ...baseValues.preferences,
      ...(overrides.preferences ?? {})
    }
  });

  it('builds point-to-point payload', () => {
    const payload = toPlanRoutePayload(makePlanInput({
      vehicleType: 'adv_motorcycle',
      preferences: {
        curvy: 70,
        scenic: 75,
        avoidHighways: 80,
        unpavedPreference: 45,
        difficulty: 50,
        distanceInfluence: 18
      }
    }));

    expect(payload.end?.lat).toBe(44.8);
    expect(payload.loopRide).toBe(false);
  });

  it('omits end for loop routes', () => {
    const payload = toPlanRoutePayload(makePlanInput({
      endLabel: '',
      endLat: '',
      endLng: '',
      loopRide: true,
      vehicleType: '4x4'
    }));

    expect(payload.end).toBeUndefined();
  });

  it('rejects blank coordinate strings', () => {
    expect(() =>
      toPlanRoutePayload({
        ...makePlanInput(),
        startLat: '   ',
        startLng: '-72.7'
      })
    ).toThrow('startLat is required');
  });

  it('rejects blank startLng', () => {
    expect(() =>
      toPlanRoutePayload({
        ...makePlanInput(),
        startLng: ' '
      })
    ).toThrow('startLng is required');
  });

  it('rejects blank endLat for point-to-point routes', () => {
    expect(() =>
      toPlanRoutePayload({
        ...makePlanInput(),
        endLat: ' '
      })
    ).toThrow('endLat is required');
  });

  it('rejects blank endLng for point-to-point routes', () => {
    expect(() =>
      toPlanRoutePayload({
        ...makePlanInput(),
        endLng: ' '
      })
    ).toThrow('endLng is required');
  });

  it('rejects non-numeric coordinates', () => {
    expect(() =>
      toPlanRoutePayload({
        ...makePlanInput(),
        startLat: 'abc'
      })
    ).toThrow('startLat must be a valid number');
  });
});
