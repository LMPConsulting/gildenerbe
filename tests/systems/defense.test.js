import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/core/state.js';
import { makeRng } from '../../src/core/rng.js';
import { createHero } from '../../src/systems/hero.js';
import {
  tickRaidCounter, RAID_EVERY_RUNS, createRaidWave, applyWallBonus,
  resolveRaid, buyWall, wallCost, repairBase,
} from '../../src/systems/defense.js';

describe('raid scheduling', () => {
  it('flags an attack after RAID_EVERY_RUNS finished runs', () => {
    const a = createInitialState();
    for (let i = 0; i < RAID_EVERY_RUNS - 1; i++) {
      expect(tickRaidCounter(a)).toBe(false);
    }
    expect(tickRaidCounter(a)).toBe(true);
    expect(a.base.underAttack).toBe(true);
  });
});

describe('raid waves', () => {
  it('scale with base development', () => {
    const small = createInitialState();
    const big = createInitialState();
    big.meta.buildings = { trainingshalle: 5, schatzkammer: 4, waffenkammer: 3 };
    const w1 = createRaidWave(small, makeRng(1));
    const w2 = createRaidWave(big, makeRng(1));
    const hp = (w) => w.reduce((s, u) => s + u.maxHp, 0);
    expect(hp(w2)).toBeGreaterThan(hp(w1));
  });
  it('wall bonus raises hero armor', () => {
    const a = createInitialState();
    a.base.wallLevel = 2;
    const h = createHero('krieger');
    const armor0 = h.armor;
    applyWallBonus(h, a);
    expect(h.armor).toBe(armor0 + 50);
  });
});

describe('raid resolution', () => {
  it('win grants Erbe and resets the counter', () => {
    const a = createInitialState();
    a.base.underAttack = true; a.base.runsSinceAttack = 4;
    const r = resolveRaid(a, true);
    expect(r.won).toBe(true);
    expect(a.meta.erbe).toBe(r.erbe);
    expect(a.base.underAttack).toBe(false);
    expect(a.base.runsSinceAttack).toBe(0);
  });
  it('loss damages the base; at 0 HP reports destroyed', () => {
    const a = createInitialState();
    a.base.hp = 40;
    const r = resolveRaid(a, false);
    expect(r.baseDamage).toBeGreaterThan(0);
    expect(a.base.hp).toBe(0);
    expect(r.baseDestroyed).toBe(true);
  });
});

describe('wall + repair', () => {
  it('buyWall spends Erbe up to max level', () => {
    const a = createInitialState();
    a.meta.erbe = 10000;
    expect(buyWall(a)).toBe(true);
    expect(a.base.wallLevel).toBe(1);
    expect(a.meta.erbe).toBe(10000 - wallCost(0));
  });
  it('repairBase converts Erbe to HP, capped at max', () => {
    const a = createInitialState();
    a.base.hp = 50; a.meta.erbe = 100;
    const healed = repairBase(a, 10);
    expect(healed).toBe(20);
    expect(a.base.hp).toBe(70);
    expect(a.meta.erbe).toBe(90);
    repairBase(a, 100); // cap
    expect(a.base.hp).toBe(a.base.maxHp);
  });
});
