import { RARITY, RARITY_ORDER, AFFIX_POOL, SLOT_NAMES, LOOT_SLOTS } from '../data/affixes.js';

function bumpRarity(key, steps) {
  const i = Math.min(RARITY_ORDER.length - 1, RARITY_ORDER.indexOf(key) + steps);
  return RARITY_ORDER[i];
}

// Roll a drop for a slain enemy. Deterministic for a given rng. Returns null on no drop.
export function rollLoot(enemy, rng) {
  const dropChance = enemy.boss || enemy.elite ? 1 : 0.6;
  if (!rng.chance(dropChance)) return null;

  let rarity = rng.weighted(Object.values(RARITY).map((r) => ({ item: r.key, weight: r.weight })));
  if (enemy.boss) rarity = bumpRarity(rarity, 2);
  else if (enemy.elite) rarity = bumpRarity(rarity, 1);

  const ilvl = enemy.level + rng.int(0, 2);
  const slot = rng.pick(LOOT_SLOTS);
  const count = RARITY[rarity].affixes;

  const pool = [...AFFIX_POOL];
  const affixes = {};
  let suffix = '';
  for (let i = 0; i < count && pool.length; i++) {
    const a = pool.splice(rng.int(0, pool.length - 1), 1)[0];
    const val = a.key === 'crit' ? +(a.per * ilvl).toFixed(3) : Math.max(1, Math.round(a.per * ilvl));
    affixes[a.key] = val;
    if (!suffix) suffix = ' ' + a.name;
  }

  const sig = Object.entries(affixes).sort().map(([k, v]) => `${k}${v}`).join('-');
  const item = {
    id: `it_${slot}_${ilvl}_${rarity}_${sig}`,
    slot,
    rarity,
    ilvl,
    affixes,
    name: `${SLOT_NAMES[slot]}${suffix}`,
  };
  if (slot === 'waffe') item.weaponDmg = 6 + ilvl * 2;
  return item;
}
