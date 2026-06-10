import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/core/rng.js';

describe('makeRng', () => {
  it('is deterministic for the same seed', () => {
    const a = makeRng(12345);
    const b = makeRng(12345);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it('produces values in [0,1)', () => {
    const r = makeRng(7);
    for (let i = 0; i < 100; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(min,max) is inclusive and within range', () => {
    const r = makeRng(99);
    for (let i = 0; i < 200; i++) {
      const v = r.int(3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('pick returns an element of the array deterministically', () => {
    const arr = ['a', 'b', 'c', 'd'];
    expect(makeRng(1).pick(arr)).toBe(makeRng(1).pick(arr));
    expect(arr).toContain(makeRng(1).pick(arr));
  });

  it('weighted respects weights (weight 0 never chosen)', () => {
    const r = makeRng(42);
    const counts = { x: 0, y: 0 };
    for (let i = 0; i < 1000; i++) {
      counts[r.weighted([{ item: 'x', weight: 3 }, { item: 'y', weight: 1 }, { item: 'z', weight: 0 }])]++;
    }
    expect(counts.x).toBeGreaterThan(counts.y); // ~3:1
    expect(counts.x + counts.y).toBe(1000);     // z (weight 0) never picked
  });
});
