import { describe, expect, it } from 'vitest';
import { formatRouteDistance } from './formatDistance';

describe('formatRouteDistance', () => {
  it('defaults to miles', () => {
    expect(formatRouteDistance(100)).toBe('62.1 mi');
  });

  it('supports kilometers explicitly', () => {
    expect(formatRouteDistance(100, 'km')).toBe('100.0 km');
  });
});
