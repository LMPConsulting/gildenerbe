import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/core/rng.js';
import { rollHit } from '../../src/systems/damage.js';

const base = { baseDamage: 100, critChance: 0, critMult: 2, targetDR: 0 };

describe('rollHit', () => {
  it('non-crit damage stays within ±10% variance of base', () => {
    const rng = makeRng(1);
    for (let i = 0; i < 50; i++) {
      const { amount, crit } = rollHit(base, rng);
      expect(crit).toBe(false);
      expect(amount).toBeGreaterThanOrEqual(90);
      expect(amount).toBeLessThanOrEqual(110);
    }
  });
  it('critChance 1 always crits and doubles (before variance)', () => {
    const rng = makeRng(2);
    const { amount, crit } = rollHit({ ...base, critChance: 1 }, rng);
    expect(crit).toBe(true);
    expect(amount).toBeGreaterThanOrEqual(180); // 200 * 0.9
    expect(amount).toBeLessThanOrEqual(220);
  });
  it('targetDR reduces damage', () => {
    const rng = makeRng(3);
    const { amount } = rollHit({ ...base, targetDR: 0.5 }, rng);
    expect(amount).toBeLessThanOrEqual(55); // ~50 ±10%
  });
  it('is deterministic for a given seed', () => {
    expect(rollHit(base, makeRng(9)).amount).toBe(rollHit(base, makeRng(9)).amount);
  });
});
