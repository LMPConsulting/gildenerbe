import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/core/state.js';
import {
  buyChronik, chronikCost, chronikLevel, buildCostMult, baseMaxHp,
  chronikOnBaseLost, destroyBase,
} from '../../src/systems/chronik.js';

describe('chronik upgrades', () => {
  it('buyChronik spends points and raises level; refuses when broke', () => {
    const a = createInitialState();
    a.chronik.punkte = 100;
    const cost = chronikCost('baumeister', 0);
    expect(buyChronik(a.chronik, 'baumeister')).toBe(true);
    expect(chronikLevel(a.chronik, 'baumeister')).toBe(1);
    expect(a.chronik.punkte).toBe(100 - cost);
    a.chronik.punkte = 0;
    expect(buyChronik(a.chronik, 'gruendung')).toBe(false);
  });
  it('baumeister reduces build costs, schutz raises base HP', () => {
    const c = { punkte: 0, upgrades: { baumeister: 2, gruendung: 0, schutz: 3 } };
    expect(buildCostMult(c)).toBeCloseTo(0.84);
    expect(baseMaxHp(c)).toBe(220);
  });
});

describe('base destruction', () => {
  it('earns chronik points scaled by buildings and resets the base, keeping chronik', () => {
    const a = createInitialState();
    a.meta.buildings = { trainingshalle: 3, schatzkammer: 2 };
    a.meta.erbe = 500;
    a.chronik.upgrades.gruendung = 2;
    a.chronik.upgrades.schutz = 1;
    const expected = chronikOnBaseLost(a.meta);
    const earned = destroyBase(a);
    expect(earned).toBe(expected);
    expect(a.chronik.punkte).toBe(expected);          // meta-meta survives & grows
    expect(a.meta.buildings).toEqual({});              // base wiped
    expect(a.meta.erbe).toBe(120);                     // gruendung 2 -> +120 start
    expect(a.base.maxHp).toBe(140);                    // schutz 1
    expect(a.base.hp).toBe(140);
    expect(a.base.generation).toBe(2);
    expect(a.stats.basesLost).toBe(1);
  });
});
