import { describe, expect, it } from 'vitest';
import { DefaultRouteScoringEngine } from './index';

describe('DefaultRouteScoringEngine', () => {
  const engine = new DefaultRouteScoringEngine();

  it('returns a normalized score breakdown', () => {
    const score = engine.scoreRoute({
      vehicleType: 'adv_motorcycle',
      preferences: {
        curvy: 85,
        scenic: 80,
        avoidHighways: 70,
        unpavedPreference: 60,
        difficulty: 65,
        distanceInfluence: 18
      },
      segments: [
        {
          lengthKm: 10,
          curvature: 80,
          roadClass: 'secondary',
          surface: 'paved',
          technicalDifficulty: 55
        },
        {
          lengthKm: 7,
          curvature: 75,
          roadClass: 'tertiary',
          surface: 'gravel',
          technicalDifficulty: 62
        }
      ]
    });

    expect(score.total).toBeGreaterThan(0);
    expect(score.total).toBeLessThanOrEqual(100);
  });
});
