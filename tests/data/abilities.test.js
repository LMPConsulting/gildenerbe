import { describe, it, expect } from 'vitest';
import { ABILITIES, getAbility } from '../../src/data/abilities.js';

const KINDS = ['attack', 'aoe', 'defensive', 'execute', 'ranged', 'nova'];

describe('ABILITIES', () => {
  it('every ability has a unique id, known kind and numeric cost/cooldown', () => {
    const ids = new Set();
    for (const a of Object.values(ABILITIES)) {
      expect(ids.has(a.id)).toBe(false); ids.add(a.id);
      expect(KINDS).toContain(a.kind);
      expect(typeof a.cost).toBe('number');
      expect(typeof a.cooldown).toBe('number');
    }
  });
  it('includes each class kit', () => {
    for (const id of ['heroic_strike', 'whirlwind', 'shield_block', 'execute',
      'sinister_strike', 'fan_of_knives', 'evasion', 'eviscerate',
      'frostbolt', 'arcane_blast', 'frost_nova', 'pyroblast']) {
      expect(getAbility(id)).toBeTruthy();
    }
  });
  it('ranged/nova abilities carry a range; martial attacks carry a coef', () => {
    expect(ABILITIES.frostbolt.projectile).toBe(true);
    expect(ABILITIES.frostbolt.spellCoef).toBeGreaterThan(0);
    expect(ABILITIES.heroic_strike.weaponCoef).toBeGreaterThan(0);
  });
  it('getAbility returns undefined for unknown id', () => {
    expect(getAbility('nope')).toBeUndefined();
  });
});
