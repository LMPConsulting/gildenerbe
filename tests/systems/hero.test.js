import { describe, it, expect } from 'vitest';
import { createHero, recomputeHero, SLOTS } from '../../src/systems/hero.js';

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
  it('exposes the equipment slots and an empty inventory', () => {
    const h = createHero('krieger');
    expect(SLOTS).toContain('waffe');
    expect(h.equipment.waffe).toBeNull();
    expect(h.inventory).toEqual([]);
  });
});

describe('recomputeHero', () => {
  it('adds equipped-item affixes into derived stats', () => {
    const h = createHero('krieger');
    const ap0 = h.ap;
    h.equipment.brust = { id: 'x', name: 'Platte', slot: 'brust', rarity: 'gruen', ilvl: 3, affixes: { str: 5 } };
    recomputeHero(h);
    expect(h.ap).toBe(ap0 + 5 * 2); // +5 STR -> +10 AP
  });
  it('applies talent mods (flat hp, crit)', () => {
    const h = createHero('krieger');
    const hp0 = h.maxHp, crit0 = h.critChance;
    h.talentMods.hp = 40; h.talentMods.crit = 0.05;
    recomputeHero(h);
    expect(h.maxHp).toBe(hp0 + 40);
    expect(h.critChance).toBeCloseTo(crit0 + 0.05);
  });
  it('preserves HP ratio across recompute', () => {
    const h = createHero('krieger');
    h.hp = Math.round(h.maxHp * 0.5);
    h.equipment.kopf = { id: 'k', slot: 'kopf', affixes: { sta: 10 }, ilvl: 1, rarity: 'gruen' };
    recomputeHero(h);
    expect(h.hp / h.maxHp).toBeCloseTo(0.5, 1);
  });
  it('equipped weapon overrides base weaponDmg', () => {
    const h = createHero('krieger');
    h.equipment.waffe = { id: 'w', slot: 'waffe', weaponDmg: 25, affixes: {}, ilvl: 5, rarity: 'blau' };
    recomputeHero(h);
    expect(h.weaponDmg).toBe(25);
  });
});
