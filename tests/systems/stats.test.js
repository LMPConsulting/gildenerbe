import { describe, it, expect } from 'vitest';
import { computeDerived, armorDR } from '../../src/systems/stats.js';

describe('computeDerived', () => {
  it('HP = 50 + level*10 + STA*10', () => {
    const d = computeDerived({ str: 10, agi: 5, int: 1, sta: 8 }, 5, { dmg: 12 });
    expect(d.maxHp).toBe(50 + 5 * 10 + 8 * 10); // 180
  });
  it('AP = STR*2 + AGI*1.5 + weapon bonus', () => {
    const d = computeDerived({ str: 10, agi: 4, int: 0, sta: 0 }, 1, { dmg: 12, bonusAp: 4 });
    expect(d.ap).toBe(10 * 2 + 4 * 1.5 + 4); // 30
    expect(d.weaponDmg).toBe(12);
  });
  it('spellPower = INT*1.5 + weapon bonus', () => {
    const d = computeDerived({ str: 0, agi: 0, int: 10, sta: 0 }, 1, { dmg: 6, bonusSp: 3 });
    expect(d.spellPower).toBe(10 * 1.5 + 3); // 18
  });
  it('crit = 0.05 + AGI*0.0006 + INT*0.0004', () => {
    const d = computeDerived({ str: 0, agi: 100, int: 50, sta: 0 }, 1, { dmg: 1 });
    expect(d.critChance).toBeCloseTo(0.05 + 100 * 0.0006 + 50 * 0.0004);
  });
});

describe('armorDR', () => {
  it('follows armor/(armor + 50*level + 400), capped at 0.75', () => {
    expect(armorDR(0, 5)).toBe(0);
    expect(armorDR(200, 5)).toBeCloseTo(200 / (200 + 250 + 400));
    expect(armorDR(1e9, 5)).toBe(0.75);
  });
});
