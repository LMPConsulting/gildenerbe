import { describe, it, expect } from 'vitest';
import { computeElapsedSeconds } from '../../src/core/time.js';

describe('computeElapsedSeconds', () => {
  it('returns whole seconds between two timestamps', () => {
    expect(computeElapsedSeconds(0, 5000, 99999)).toBe(5);
    expect(computeElapsedSeconds(0, 5999, 99999)).toBe(5); // floors
  });

  it('clamps to the cap', () => {
    expect(computeElapsedSeconds(0, 60_000, 30)).toBe(30);
  });

  it('never returns negative (clock moved backwards)', () => {
    expect(computeElapsedSeconds(10_000, 5_000, 99999)).toBe(0);
  });
});
