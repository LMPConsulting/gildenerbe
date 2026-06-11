import { recomputeHero } from './hero.js';
import { affixByKey, RARITY_ORDER, ARMORTYPE_PRIMARY } from '../data/affixes.js';
import { consumeMats, hasMats } from './materials.js';

// Hub enchanting: costs materials gathered on runs, and the success CHANCE +
// strength scale with how well the rune puzzle was solved (quality 0..1).

// Material cost scales with rarity + item level.
export function ENCHANT_COST(item) {
  const ri = Math.max(0, RARITY_ORDER.indexOf(item.rarity));
  const cost = { kupfererz: 2 + Math.ceil(item.ilvl / 2), kraeuter: 1 + ri };
  if (ri >= 3) cost.eisenerz = ri - 1; // blau+ wants iron
  return cost;
}

// 0.4 (sloppy) -> 0.95 (fast/clean). Strictly increasing in quality.
export function enchantChance(quality) {
  const q = Math.max(0, Math.min(1, quality));
  return Math.min(0.95, Math.max(0.4, 0.4 + q * 0.55));
}

// Affix magnitude multiplier from quality.
export const enchantTier = (quality) => 0.8 + Math.max(0, Math.min(1, quality)) * 0.9;

// Pick the affix to add — favour the item's themed stat.
function pickAffixKey(item, rng) {
  if (item.armorType) return ARMORTYPE_PRIMARY[item.armorType];
  if (item.slot === 'waffe') return item.classReq?.[0] === 'magier' ? 'spellPower' : item.classReq?.[0] === 'schurke' ? 'agi' : 'ap';
  return rng.pick(['sta', 'crit', 'str', 'agi', 'int']);
}

// Try to enchant. Always consumes the cost (success OR fail). On success rolls
// an affix and merges it into item.affixes (additive), tagging the name.
// Returns { success, affix, item, paid }.
export function applyEnchant(item, quality, rng, materialsBag) {
  const cost = ENCHANT_COST(item);
  if (!hasMats(materialsBag, cost)) return { success: false, affix: null, item, paid: false };
  consumeMats(materialsBag, cost);
  if (!rng.chance(enchantChance(quality))) return { success: false, affix: null, item, paid: true };
  const key = pickAffixKey(item, rng);
  const per = affixByKey[key]?.per ?? 1;
  const mag = enchantTier(quality) * Math.max(1, item.ilvl);
  const value = key === 'crit' ? +(per * mag).toFixed(3) : Math.max(1, Math.round(per * mag * 0.6));
  item.affixes = item.affixes || {};
  item.affixes[key] = +((item.affixes[key] || 0) + value).toFixed(3);
  item.enchanted = (item.enchanted || 0) + 1;
  if (!/verzaubert/.test(item.name)) item.name += ' (verzaubert)';
  return { success: true, affix: { key, value, name: affixByKey[key]?.name }, item, paid: true };
}

// --- legacy helper kept for any direct callers ---
export function enchantItem(hero, item, affix) {
  item.affixes = item.affixes || {};
  item.affixes[affix.key] = (item.affixes[affix.key] || 0) + affix.value;
  item.enchanted = true;
  if (hero) recomputeHero(hero);
  return item;
}
export const enchantValue = (quality, key) =>
  key === 'crit' ? +(0.01 + quality * 0.03).toFixed(3) : Math.round(2 + quality * 4);
