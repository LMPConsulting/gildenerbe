import { describe, it, expect } from 'vitest';
import { createHero, recomputeHero } from '../../src/systems/hero.js';
import { enchantItem } from '../../src/systems/enchanting.js';

describe('enchanting', () => {
  it('adds an affix to an item and recomputes when equipped', () => {
    const h = createHero('krieger');
    const item = { id: 'i', slot: 'brust', rarity: 'gruen', ilvl: 4, affixes: { str: 3 } };
    h.equipment.brust = item;
    recomputeHero(h);
    const ap0 = h.ap;
    enchantItem(h, item, { key: 'str', value: 4 });
    expect(item.affixes.str).toBe(7);
    expect(item.enchanted).toBe(true);
    expect(h.ap).toBe(ap0 + 8); // +4 STR -> +8 AP
  });
});
