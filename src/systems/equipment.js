import { recomputeHero } from './hero.js';

// Equip an item into its slot. Any previously equipped item goes to inventory.
// Returns the previously equipped item (or null). Recomputes hero stats.
export function equipItem(hero, item) {
  const slot = item.slot;
  const prev = hero.equipment[slot] || null;
  const idx = hero.inventory.indexOf(item);
  if (idx >= 0) hero.inventory.splice(idx, 1);
  hero.equipment[slot] = item;
  if (prev) hero.inventory.push(prev);
  recomputeHero(hero);
  return prev;
}
