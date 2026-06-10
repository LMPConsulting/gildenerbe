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
});
