import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/core/state.js';
import { startMission, missionRemainingMs, resolveMissionIfDone, MISSIONS } from '../../src/systems/missions.js';

const NOW = 1_000_000;

describe('missions', () => {
  it('startMission spends Erbe and sets the active mission', () => {
    const a = createInitialState();
    a.meta.erbe = 50;
    expect(startMission(a, 'kundschaft', NOW)).toBe(true);
    expect(a.meta.erbe).toBe(50 - MISSIONS.kundschaft.cost.erbe);
    expect(a.missions.active.id).toBe('kundschaft');
    expect(startMission(a, 'jagdzug', NOW)).toBe(false); // one at a time
  });
  it('refuses when Erbe is insufficient', () => {
    const a = createInitialState();
    expect(startMission(a, 'expedition', NOW)).toBe(false);
  });
  it('does not resolve before the duration elapsed', () => {
    const a = createInitialState();
    a.meta.erbe = 50;
    startMission(a, 'kundschaft', NOW);
    expect(missionRemainingMs(a, NOW + 60_000)).toBeGreaterThan(0);
    expect(resolveMissionIfDone(a, NOW + 60_000)).toBeNull();
    expect(a.missions.active).not.toBeNull();
  });
  it('resolves after the duration with rewards and clears the slot', () => {
    const a = createInitialState();
    a.meta.erbe = 50;
    startMission(a, 'kundschaft', NOW);
    const erbeBefore = a.meta.erbe;
    const done = NOW + MISSIONS.kundschaft.durationMin * 60_000 + 1;
    const r = resolveMissionIfDone(a, done);
    expect(r).not.toBeNull();
    expect(r.erbe).toBeGreaterThan(0);
    expect(a.meta.erbe).toBe(erbeBefore + r.erbe);
    expect(Object.keys(r.mats).length).toBeGreaterThan(0);
    expect(a.missions.active).toBeNull();
  });
  it('is deterministic for a given seed', () => {
    const make = () => {
      const a = createInitialState();
      a.meta.erbe = 50;
      startMission(a, 'jagdzug', NOW);
      return resolveMissionIfDone(a, NOW + 999_000_000);
    };
    expect(make()).toEqual(make());
  });
});
