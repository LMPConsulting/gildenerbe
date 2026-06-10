import { describe, it, expect } from 'vitest';
import { createMemoryStorage } from '../../src/core/storage.js';
import { saveGame, loadGame, clearSave, SAVE_VERSION } from '../../src/core/save.js';

describe('save/load', () => {
  it('round-trips state', () => {
    const s = createMemoryStorage();
    const state = { version: SAVE_VERSION, meta: { erbe: 42 } };
    saveGame(s, state);
    expect(loadGame(s)).toEqual(state);
  });

  it('returns null when nothing is saved', () => {
    expect(loadGame(createMemoryStorage())).toBeNull();
  });

  it('returns null on corrupt JSON', () => {
    const s = createMemoryStorage();
    s.setItem('gildenerbe.save', '{not json');
    expect(loadGame(s)).toBeNull();
  });

  it('clearSave removes the save', () => {
    const s = createMemoryStorage();
    saveGame(s, { version: SAVE_VERSION, meta: {} });
    clearSave(s);
    expect(loadGame(s)).toBeNull();
  });

  it('migrates a v1 save to v2 (base, chronik, missions, tutorial flag)', () => {
    const s = createMemoryStorage();
    const v1State = { version: 1, meta: { erbe: 50, buildings: { trainingshalle: 2 } }, stats: { totalRuns: 3, bestZone: 2, playTicks: 0 } };
    s.setItem('gildenerbe.save', JSON.stringify({ version: 1, state: v1State }));
    const loaded = loadGame(s);
    expect(loaded.meta.erbe).toBe(50);                       // old data kept
    expect(loaded.meta.buildings.trainingshalle).toBe(2);
    expect(loaded.base.hp).toBe(100);                        // new fields added
    expect(loaded.chronik.punkte).toBe(0);
    expect(loaded.missions.active).toBeNull();
    expect(loaded.tutorialSeen).toBe(true);                  // veterans skip tutorial
    expect(loaded.stats.totalRuns).toBe(3);
    expect(loaded.stats.basesLost).toBe(0);
  });
});
