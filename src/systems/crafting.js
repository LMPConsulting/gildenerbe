import { SMELT, CRAFT } from '../data/recipes.js';
import { consumeMats, addMat } from './materials.js';
import { AFFIX_POOL, RARITY_ORDER } from '../data/affixes.js';

// Smelt ore -> bar. Returns true on success.
export function smelt(bag, barKey) {
  const r = SMELT[barKey];
  if (!r || !consumeMats(bag, r.in)) return false;
  addMat(bag, r.out, 1);
  return true;
}

// Craft bars -> a gear item. `quality` (0..1) from the perfect-cast minigame
// raises the item's rarity. Returns the item, or null if materials are missing.
export function craft(bag, recipeKey, quality, rng) {
  const r = CRAFT[recipeKey];
  if (!r || !consumeMats(bag, r.in)) return null;

  let rarityIdx = 2; // 'gruen' baseline for crafted gear
  if (quality >= 0.8) rarityIdx += 1;   // 'blau'
  if (quality >= 0.98) rarityIdx += 1;  // 'lila' (perfect)
  rarityIdx = Math.min(RARITY_ORDER.length - 1, rarityIdx);
  const rarity = RARITY_ORDER[rarityIdx];
  const affCount = Math.max(1, rarityIdx - 1);

  const pool = [...AFFIX_POOL];
  const affixes = {};
  for (let i = 0; i < affCount && pool.length; i++) {
    const a = pool.splice(rng.int(0, pool.length - 1), 1)[0];
    affixes[a.key] = a.key === 'crit'
      ? +(a.per * r.ilvl).toFixed(3)
      : Math.max(1, Math.round(a.per * r.ilvl));
  }

  const item = { id: `craft_${recipeKey}_${rarity}`, name: r.name, slot: r.slot, rarity, ilvl: r.ilvl, affixes };
  if (r.slot === 'waffe') item.weaponDmg = 6 + r.ilvl * 2;
  return item;
}
