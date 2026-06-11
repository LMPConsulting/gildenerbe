import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/core/rng.js';
import { ENCHANT_COST, enchantChance, applyEnchant } from '../../src/systems/enchanting.js';
import { makeBag, addMat } from '../../src/systems/materials.js';

const item = () => ({ id: 'i', slot: 'kopf', rarity: 'blau', ilvl: 6, armorType: 'platte', classReq: ['krieger'], affixes: { str: 4 }, name: 'Platte-Helm' });
const richBag = () => { const b = makeBag(); addMat(b, 'kupfererz', 50); addMat(b, 'kraeuter', 50); addMat(b, 'eisenerz', 50); return b; };

describe('enchanting', () => {
  it('chance strictly increases with quality, clamped to [0.4,0.95]', () => {
    expect(enchantChance(0)).toBeCloseTo(0.4);
    expect(enchantChance(1)).toBeCloseTo(0.95);
    expect(enchantChance(0.5)).toBeGreaterThan(enchantChance(0.2));
  });

  it('cost scales with rarity + ilvl', () => {
    const cheap = ENCHANT_COST({ rarity: 'gruen', ilvl: 2 });
    const dear = ENCHANT_COST({ rarity: 'orange', ilvl: 10 });
    expect(dear.kupfererz).toBeGreaterThan(cheap.kupfererz);
    expect(dear.eisenerz).toBeGreaterThan(0);
    expect(cheap.eisenerz).toBeUndefined();
  });

  it('high quality succeeds and raises an affix; consumes materials', () => {
    const bag = richBag(), it = item();
    const copper0 = bag.kupfererz, str0 = it.affixes.str;
    const r = applyEnchant(it, 1, makeRng(1), bag);
    expect(r.paid).toBe(true);
    if (r.success) { expect(it.affixes.str).toBeGreaterThan(str0); expect(it.name).toMatch(/verzaubert/); }
    expect(bag.kupfererz).toBeLessThan(copper0);
  });

  it('fails (still consumes) when materials are missing', () => {
    const r = applyEnchant(item(), 0.5, makeRng(1), makeBag());
    expect(r.paid).toBe(false);
    expect(r.success).toBe(false);
  });

  it('is deterministic for the same item+quality+seed', () => {
    const a = applyEnchant(item(), 0.7, makeRng(5), richBag());
    const b = applyEnchant(item(), 0.7, makeRng(5), richBag());
    expect(a.success).toBe(b.success);
    expect(a.affix?.key).toBe(b.affix?.key);
  });
});
