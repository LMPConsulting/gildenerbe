import { recomputeHero } from './hero.js';

// Apply an affix (from a solved rune puzzle) to an item, then recompute the
// hero in case the item is equipped. affix = { key, value }.
export function enchantItem(hero, item, affix) {
  item.affixes = item.affixes || {};
  item.affixes[affix.key] = (item.affixes[affix.key] || 0) + affix.value;
  item.enchanted = true;
  recomputeHero(hero);
  return item;
}

// Map a puzzle's solve quality (0..1, e.g. by grid size/pairs) to an affix value.
export const enchantValue = (quality, key) =>
  key === 'crit' ? +(0.01 + quality * 0.03).toFixed(3) : Math.round(2 + quality * 4);
