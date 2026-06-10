import { describe, it, expect } from 'vitest';
import { createHero } from '../../src/systems/hero.js';
import { equipItem } from '../../src/systems/equipment.js';

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
