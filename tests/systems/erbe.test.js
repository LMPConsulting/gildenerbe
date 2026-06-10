import { describe, it, expect } from 'vitest';
import { createHero } from '../../src/systems/hero.js';
import { computeErbe, offlineErbe, offlineCapSeconds } from '../../src/systems/erbe.js';

const meta = (sk = 0) => ({ erbe: 0, buildings: { schatzkammer: sk } });

describe('computeErbe', () => {
  it('grows with hero level and encounters cleared', () => {
    const h = createHero('krieger');
    const low = computeErbe(h, 1, meta());
    h.level = 6;
    const high = computeErbe(h, 5, meta());
    expect(high).toBeGreaterThan(low);
  });
  it('is boosted by the Schatzkammer', () => {
    const h = createHero('krieger'); h.level = 5;
    expect(computeErbe(h, 3, meta(4))).toBeGreaterThan(computeErbe(h, 3, meta(0)));
  });
  it('never returns less than 1', () => {
    expect(computeErbe(createHero('krieger'), 0, meta())).toBeGreaterThanOrEqual(1);
  });
});

describe('offline yield', () => {
  it('Schatzkammer grants Erbe per minute away; none without it', () => {
    expect(offlineErbe(meta(0), 3600)).toBe(0);
    expect(offlineErbe(meta(2), 600)).toBe(20); // 2/min * 10 min
  });
  it('offline cap grows with Schatzkammer level', () => {
    expect(offlineCapSeconds(meta(0))).toBe(8 * 3600);
    expect(offlineCapSeconds(meta(2))).toBe(16 * 3600);
  });
});
