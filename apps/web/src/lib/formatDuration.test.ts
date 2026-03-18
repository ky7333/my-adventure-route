import { describe, expect, it } from 'vitest';
import { formatRouteDuration } from './formatDuration';

describe('formatRouteDuration', () => {
  it('shows minutes for durations up to and including 60 minutes', () => {
    expect(formatRouteDuration(42)).toBe('42 min');
    expect(formatRouteDuration(60)).toBe('60 min');
  });

  it('shows hours and minutes for durations above 60 minutes', () => {
    expect(formatRouteDuration(61)).toBe('1h 1m');
    expect(formatRouteDuration(120)).toBe('2h 0m');
  });
});
