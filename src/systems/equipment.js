import { recomputeHero } from './hero.js';
import { canUse } from '../data/affixes.js';

export function canEquip(hero, item) {
  return !!item && !!item.slot && canUse(hero, item);
}

// Equip an item into its slot (rejected if the class can't use it). Any
// previously equipped item goes to inventory. Returns the previous item or null.
export function equipItem(hero, item) {
  if (!canEquip(hero, item)) return null;
  const slot = item.slot;
  const prev = hero.equipment[slot] || null;
  const idx = hero.inventory.indexOf(item);
  if (idx >= 0) hero.inventory.splice(idx, 1);
  hero.equipment[slot] = item;
  if (prev) hero.inventory.push(prev);
  recomputeHero(hero);
  return prev;
}

// Stat deltas of swapping `item` into its slot vs the currently equipped piece —
// drives the comparison tooltip. Returns { rows:[{key,delta}], usable, current }.
export function compareItem(hero, item) {
  const cur = hero.equipment[item.slot] || null;
  const a = item.affixes || {}, b = cur?.affixes || {};
  const keys = ['str', 'agi', 'int', 'sta', 'ap', 'spellPower', 'crit', 'armor', 'hp'];
  const rows = [];
  for (const k of keys) {
    let d = (a[k] || 0) - (b[k] || 0);
    if (k === 'crit') d = +d.toFixed(3);
    if (d) rows.push({ key: k, delta: d });
  }
  if (item.slot === 'waffe') {
    const d = (item.weaponDmg || 0) - (cur?.weaponDmg || 0);
    if (d) rows.push({ key: 'weaponDmg', delta: d });
  }
  return { rows, usable: canUse(hero, item), current: cur };
}
