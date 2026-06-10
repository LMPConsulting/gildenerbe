import { describe, it, expect } from 'vitest';
import { createHero } from '../../src/systems/hero.js';

describe('createHero', () => {
  it('creates a level-1 Krieger with full hp, rage resource and a weapon', () => {
    const h = createHero('krieger');
    expect(h.side).toBe('hero');
    expect(h.level).toBe(1);
    expect(h.hp).toBe(h.maxHp);
    expect(h.resource.type).toBe('rage');
    expect(h.weaponDmg).toBeGreaterThan(0);
    expect(h.abilities).toContain('heroic_strike');
  });
  it('throws on unknown class', () => {
    expect(() => createHero('wizardd')).toThrow();
  });
});
