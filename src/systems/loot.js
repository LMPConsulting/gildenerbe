import {
  RARITY, RARITY_ORDER, AFFIX_POOL, affixByKey, SLOT_NAMES, LOOT_SLOTS,
  ARMOR_SLOTS, JEWELRY_SLOTS, ARMORTYPE_CLASS, ARMORTYPE_NAME, ARMORTYPE_PRIMARY,
} from '../data/affixes.js';

function bumpRarity(key, steps) {
  const i = Math.min(RARITY_ORDER.length - 1, RARITY_ORDER.indexOf(key) + steps);
  return RARITY_ORDER[i];
}

const WEAPON_KINDS = [
  { name: 'Schwert', classReq: ['krieger'], primary: 'str' },
  { name: 'Dolch', classReq: ['schurke'], primary: 'agi' },
  { name: 'Stab', classReq: ['magier'], primary: 'int' },
];
const ARMOR_TYPES = ['platte', 'leder', 'stoff'];

// Roll a drop for a slain enemy. Drops for ANY class (so off-class gear is worth
// banking in the shared chest). Deterministic for a given rng; null on no drop.
export function rollLoot(enemy, rng) {
  const dropChance = enemy.boss || enemy.elite ? 1 : 0.55;
  if (!rng.chance(dropChance)) return null;

  let rarity = rng.weighted(Object.values(RARITY).map((r) => ({ item: r.key, weight: r.weight })));
  if (enemy.boss) rarity = bumpRarity(rarity, 2);
  else if (enemy.elite) rarity = bumpRarity(rarity, 1);

  const ilvl = enemy.level + rng.int(0, 2);
  const slot = rng.pick(LOOT_SLOTS);
  const count = RARITY[rarity].affixes;

  // class binding + a favoured stat by item type
  let armorType = null, classReq = null, favoured = null, typeLabel = '';
  if (ARMOR_SLOTS.includes(slot)) {
    armorType = rng.pick(ARMOR_TYPES); classReq = [ARMORTYPE_CLASS[armorType]];
    favoured = ARMORTYPE_PRIMARY[armorType]; typeLabel = ARMORTYPE_NAME[armorType] + '-';
  } else if (slot === 'waffe') {
    const wk = rng.pick(WEAPON_KINDS); classReq = wk.classReq; favoured = wk.primary;
  }

  // weighted affix pool: favoured stat (and its damage stat) more likely
  const weightFor = (a) => {
    if (favoured && a.key === favoured) return 6;
    if (favoured === 'str' && a.key === 'ap') return 4;
    if (favoured === 'agi' && (a.key === 'ap' || a.key === 'crit')) return 3;
    if (favoured === 'int' && a.key === 'spellPower') return 4;
    if (a.key === 'sta') return 3;
    return 1;
  };
  const pool = AFFIX_POOL.filter((a) => !(slot && JEWELRY_SLOTS.includes(slot) && a.key === 'armor') || true).slice();
  const affixes = {};
  let suffix = '';
  for (let i = 0; i < count && pool.length; i++) {
    const a = rng.weighted(pool.map((x) => ({ item: x, weight: weightFor(x) })));
    pool.splice(pool.indexOf(a), 1);
    const val = a.key === 'crit' ? +(a.per * ilvl).toFixed(3) : Math.max(1, Math.round(a.per * ilvl));
    affixes[a.key] = val;
    if (!suffix) suffix = ' ' + a.name;
  }
  // armour items always carry some armor stat
  if (ARMOR_SLOTS.includes(slot) && !affixes.armor) affixes.armor = Math.max(2, Math.round(affixByKey.armor.per * ilvl * (armorType === 'platte' ? 1.4 : armorType === 'leder' ? 1.0 : 0.6)));

  const baseName = slot === 'waffe' ? (classReq[0] === 'magier' ? 'Stab' : classReq[0] === 'schurke' ? 'Dolch' : 'Schwert') : SLOT_NAMES[slot];
  const item = {
    id: `it_${slot}_${ilvl}_${rarity}_${rng.int(0, 99999)}`,
    slot, rarity, ilvl, armorType, classReq,
    affixes, name: `${typeLabel}${baseName}${suffix}`,
  };
  if (slot === 'waffe') item.weaponDmg = 6 + ilvl * 2;
  return item;
}
