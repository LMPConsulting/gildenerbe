import { describe, it, expect } from 'vitest';
import { ABILITIES, getAbility } from '../../src/data/abilities.js';

describe('ABILITIES', () => {
  it('every ability has unique id and required numeric fields', () => {
    const ids = new Set();
    for (const a of Object.values(ABILITIES)) {
      expect(ids.has(a.id)).toBe(false); ids.add(a.id);
      expect(typeof a.cost).toBe('number');
      expect(typeof a.cooldown).toBe('number');
      expect(['attack', 'aoe', 'defensive', 'execute']).toContain(a.kind);
    }
  });
  it('includes the core Krieger kit', () => {
    for (const id of ['heroic_strike', 'whirlwind', 'shield_block', 'execute']) {
      expect(getAbility(id)).toBeTruthy();
    }
  });
  it('getAbility returns undefined for unknown id', () => {
    expect(getAbility('nope')).toBeUndefined();
  });
});
