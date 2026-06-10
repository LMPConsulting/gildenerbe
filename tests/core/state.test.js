import { describe, it, expect } from 'vitest';
import { createInitialState, GAME_VERSION } from '../../src/core/state.js';

describe('createInitialState', () => {
  it('starts a fresh account with no run and zero Erbe', () => {
    const s = createInitialState();
    expect(s.version).toBe(GAME_VERSION);
    expect(s.run).toBeNull();
    expect(s.meta.erbe).toBe(0);
  });

  it('unlocks the Krieger class by default', () => {
    expect(createInitialState().meta.unlockedClasses).toContain('krieger');
  });

  it('returns a fresh object each call (no shared references)', () => {
    const a = createInitialState();
    const b = createInitialState();
    a.meta.erbe = 999;
    expect(b.meta.erbe).toBe(0);
  });
});
