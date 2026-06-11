import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/core/rng.js';
import { createHero } from '../../src/systems/hero.js';
import { equipItem, canEquip, compareItem } from '../../src/systems/equipment.js';
import { rollLoot } from '../../src/systems/loot.js';
import { makeEnemy } from '../../src/data/enemies.js';
import { depositItem, withdrawItem } from '../../src/systems/chest.js';

let n = 0;
const item = (slot, affixes, extra = {}) => ({ id: 'i' + (n++), slot, rarity: 'gruen', ilvl: 4, affixes, ...extra });

describe('equipItem', () => {
  it('equips into its slot, recomputes stats, returns null when slot was empty', () => {
    const h = createHero('krieger');
    const ap0 = h.ap;
    const prev = equipItem(h, item('brust', { str: 6 }));
    expect(prev).toBeNull();
    expect(h.equipment.brust).toBeTruthy();
    expect(h.ap).toBe(ap0 + 12); // +6 STR -> +12 AP
  });
  it('swapping returns the previously equipped item to inventory', () => {
    const h = createHero('krieger');
    const a = item('brust', { str: 6 });
    const b = item('brust', { str: 10 });
    equipItem(h, a);
    const prev = equipItem(h, b);
    expect(prev).toBe(a);
    expect(h.inventory).toContain(a);
    expect(h.equipment.brust).toBe(b);
  });
  it('removes the equipped item from inventory if it was there', () => {
    const h = createHero('krieger');
    const a = item('kopf', { sta: 5 });
    h.inventory.push(a);
    equipItem(h, a);
    expect(h.inventory).not.toContain(a);
  });
});

const plateHelm = { id: 'p', slot: 'kopf', rarity: 'blau', ilvl: 5, armorType: 'platte', classReq: ['krieger'], affixes: { str: 4, armor: 12 } };
const clothHelm = { id: 'c', slot: 'kopf', rarity: 'blau', ilvl: 5, armorType: 'stoff', classReq: ['magier'], affixes: { int: 6, armor: 4 } };
const ring = { id: 'r', slot: 'ring1', rarity: 'gruen', ilvl: 5, classReq: null, affixes: { crit: 0.02 } };

describe('class-restricted equipment', () => {
  it('a warrior may equip plate + jewellery but not cloth', () => {
    const k = createHero('krieger');
    expect(canEquip(k, plateHelm)).toBe(true);
    expect(canEquip(k, ring)).toBe(true);
    expect(canEquip(k, clothHelm)).toBe(false);
    k.inventory.push(clothHelm);
    expect(equipItem(k, clothHelm)).toBeNull();
    expect(k.equipment.kopf).toBeNull();
  });
});

describe('comparison deltas', () => {
  it('reports stat differences vs the equipped slot', () => {
    const k = createHero('krieger');
    k.equipment.kopf = { slot: 'kopf', affixes: { str: 2, armor: 10 } };
    const byKey = Object.fromEntries(compareItem(k, plateHelm).rows.map((r) => [r.key, r.delta]));
    expect(byKey.str).toBe(2);
    expect(byKey.armor).toBe(2);
  });
});

describe('loot armour binding', () => {
  it('rolled armour carries an armour type + single class requirement', () => {
    const rng = makeRng(3); let found = false;
    for (let i = 0; i < 80; i++) {
      const it = rollLoot(makeEnemy('rudelfuehrer'), rng);
      if (it && ['kopf', 'brust', 'beine', 'haende', 'fuesse'].includes(it.slot)) {
        found = true; expect(it.armorType).toBeTruthy(); expect(it.classReq).toHaveLength(1);
      }
    }
    expect(found).toBe(true);
  });
});

describe('shared chest', () => {
  it('banks gear across heroes', () => {
    const account = { chest: [] };
    const a = createHero('krieger'); a.inventory.push(clothHelm);
    expect(depositItem(account, a, clothHelm)).toBe(true);
    expect(account.chest).toContain(clothHelm);
    const b = createHero('magier');
    expect(withdrawItem(account, b, clothHelm)).toBe(true);
    expect(canEquip(b, clothHelm)).toBe(true);
  });
});
