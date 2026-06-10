import { describe, it, expect } from 'vitest';
import { createRun } from '../../src/run.js';
import { makeEnemy } from '../../src/data/enemies.js';

describe('createRun (floor-based)', () => {
  it('advances through floors on clear and ends cleared', () => {
    const run = createRun();
    const total = run.zone.floors.length;
    for (let i = 0; i < total; i++) {
      expect(run.index).toBe(i);
      expect(run.currentFloor()).toBeTruthy();
      run.onFloorEnd('cleared');
    }
    expect(run.result).toBe('cleared');
  });

  it('ends fallen on a hero death', () => {
    const run = createRun();
    run.onFloorEnd('fallen');
    expect(run.result).toBe('fallen');
  });

  it('the last floor is the boss floor', () => {
    const run = createRun();
    expect(run.zone.floors[run.zone.floors.length - 1].kind).toBe('boss');
  });

  it('heals the hero between floors', () => {
    const run = createRun();
    run.hero.hp = 10;
    run.onFloorEnd('cleared');
    expect(run.hero.hp).toBeGreaterThan(10);
  });

  it('grantRewards gives xp, possible drops, and materials', () => {
    const run = createRun();
    const killed = [makeEnemy('waldwolf'), makeEnemy('raeuber')];
    const r = run.grantRewards(killed);
    expect(r.xp).toBe(killed[0].xp + killed[1].xp);
    expect(run.materials.kupfererz).toBeGreaterThan(0);
  });

  it('chest loot is guaranteed and lands in the inventory', () => {
    const run = createRun();
    const before = run.hero.inventory.length;
    const item = run.rollChestLoot();
    expect(item).toBeTruthy();
    expect(run.hero.inventory.length).toBe(before + 1);
  });

  it('floorSeed is deterministic per floor index', () => {
    const a = createRun(); const b = createRun();
    expect(a.floorSeed()).toBe(b.floorSeed());
    a.onFloorEnd('cleared');
    expect(a.floorSeed()).not.toBe(b.floorSeed());
  });
});
