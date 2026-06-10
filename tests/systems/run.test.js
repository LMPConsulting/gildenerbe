import { describe, it, expect } from 'vitest';
import { createRun } from '../../src/run.js';

describe('createRun', () => {
  it('advances through encounters on win and ends cleared', () => {
    const run = createRun();
    const total = run.zone.encounters.length;
    for (let i = 0; i < total; i++) {
      expect(run.index).toBe(i);
      run.onCombatEnd('won');
    }
    expect(run.result).toBe('cleared');
  });

  it('ends fallen on a loss', () => {
    const run = createRun();
    run.onCombatEnd('lost');
    expect(run.result).toBe('fallen');
  });

  it('buildSim creates a combat for the current encounter, carrying the same hero', () => {
    const run = createRun();
    const sim = run.buildSim();
    expect(sim.state.enemies.length).toBe(run.currentEncounter().length);
    expect(sim.state.hero).toBe(run.hero);
  });

  it('heals the hero between wins', () => {
    const run = createRun();
    run.hero.hp = 10;
    run.onCombatEnd('won');
    expect(run.hero.hp).toBeGreaterThan(10);
  });
});
