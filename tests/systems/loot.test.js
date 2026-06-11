import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/core/rng.js';
import { makeEnemy } from '../../src/data/enemies.js';
import { rollLoot } from '../../src/systems/loot.js';
import { RARITY } from '../../src/data/affixes.js';

describe('rollLoot', () => {
  it('is deterministic for a given seed', () => {
    const a = rollLoot(makeEnemy('raeuber'), makeRng(4));
    const b = rollLoot(makeEnemy('raeuber'), makeRng(4));
    expect(a).toEqual(b);
  });
  it('boss always drops with at least its rarity affix count (armour adds a guaranteed armor stat)', () => {
    const drop = rollLoot(makeEnemy('krell'), makeRng(2));
    expect(drop).not.toBeNull();
    expect(Object.keys(drop.affixes).length).toBeGreaterThanOrEqual(RARITY[drop.rarity].affixes);
    expect(drop.ilvl).toBeGreaterThanOrEqual(makeEnemy('krell').level);
  });
  it('weapon drops carry weaponDmg; other slots do not', () => {
    let wpn = null, other = null;
    for (let s = 0; s < 80 && (!wpn || !other); s++) {
      const it = rollLoot(makeEnemy('krell'), makeRng(s));
      if (!it) continue;
      if (it.slot === 'waffe') wpn = it; else other = it;
    }
    if (wpn) expect(wpn.weaponDmg).toBeGreaterThan(0);
    if (other) expect(other.weaponDmg).toBeUndefined();
  });
});
