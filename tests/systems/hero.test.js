import { describe, it, expect } from 'vitest';
import { createHero, recomputeHero, abilityBaseDamage } from '../../src/systems/hero.js';
import { getAbility } from '../../src/data/abilities.js';

describe('createHero', () => {
  it('creates each class with its armor type, resource and weapon kind', () => {
    const k = createHero('krieger');
    expect(k.armorType).toBe('platte');
    expect(k.resource.type).toBe('rage');
    expect(k.resource.value).toBe(0);        // rage starts empty
    expect(k.weaponKind).toBe('melee');
    expect(k.hp).toBe(k.maxHp);

    const r = createHero('schurke');
    expect(r.armorType).toBe('leder');
    expect(r.resource.type).toBe('energie');
    expect(r.resource.value).toBe(r.resource.max); // energy starts full
    expect(r.abilities).toContain('eviscerate');

    const m = createHero('magier');
    expect(m.armorType).toBe('stoff');
    expect(m.resource.type).toBe('mana');
    expect(m.weaponKind).toBe('ranged');
    expect(m.spellPower).toBeGreaterThan(0);
  });

  it('throws on unknown class', () => {
    expect(() => createHero('hexer')).toThrow();
  });

  it('applies a pre-run food buff', () => {
    const base = createHero('krieger');
    const fed = createHero('krieger', { foodBuff: { stat: 'str', value: 10 } });
    expect(fed.primary.str).toBe(base.primary.str + 10);
    expect(fed.ap).toBeGreaterThan(base.ap);
  });
});

describe('recomputeHero', () => {
  it('adds equipped affixes (incl. spellPower) and weapon damage', () => {
    const m = createHero('magier');
    const sp0 = m.spellPower;
    m.equipment.kopf = { slot: 'kopf', affixes: { int: 10, spellPower: 5 } };
    m.equipment.waffe = { slot: 'waffe', affixes: {}, weaponDmg: 20 };
    recomputeHero(m);
    expect(m.spellPower).toBeGreaterThan(sp0);
    expect(m.weaponDmg).toBe(20);
  });
});

describe('abilityBaseDamage', () => {
  it('scales martial off weapon+AP and spells off spellPower', () => {
    const k = createHero('krieger');
    const martial = abilityBaseDamage(k, getAbility('heroic_strike'));
    expect(martial).toBeCloseTo(k.weaponDmg * 1.2 + k.ap * 0.15);
    const m = createHero('magier');
    const spell = abilityBaseDamage(m, getAbility('frostbolt'));
    expect(spell).toBeCloseTo(m.spellPower * 1.3 + m.level * 2);
  });
});
