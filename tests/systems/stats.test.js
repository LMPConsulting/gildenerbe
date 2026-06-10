import { describe, it, expect } from 'vitest';
import { computeDerived, armorDR } from '../../src/systems/stats.js';

describe('computeDerived', () => {
  it('HP = 50 + level*10 + STA*10', () => {
    const d = computeDerived({ str: 10, agi: 5, int: 1, sta: 8 }, 5, { dmg: 12, bonusAp: 0 });
    expect(d.maxHp).toBe(50 + 5 * 10 + 8 * 10); // 180
  });
  it('AP = STR*2 + weapon bonus, weaponDmg from weapon', () => {
    const d = computeDerived({ str: 10, agi: 0, int: 0, sta: 0 }, 1, { dmg: 12, bonusAp: 4 });
    expect(d.ap).toBe(24);        // 10*2 + 4
    expect(d.weaponDmg).toBe(12);
  });
  it('crit = 0.05 base + AGI*0.0005', () => {
    const d = computeDerived({ str: 0, agi: 100, int: 0, sta: 0 }, 1, { dmg: 1, bonusAp: 0 });
    expect(d.critChance).toBeCloseTo(0.05 + 100 * 0.0005); // 0.10
  });
});

describe('armorDR', () => {
  it('follows armor/(armor + 50*level + 400) and is in [0,0.75]', () => {
    expect(armorDR(0, 5)).toBe(0);
    expect(armorDR(200, 5)).toBeCloseTo(200 / (200 + 250 + 400)); // ~0.235
    expect(armorDR(1e9, 5)).toBe(0.75); // capped
  });
});
