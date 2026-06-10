import { computeDerived } from './stats.js';

export const SLOTS = ['waffe', 'kopf', 'brust', 'beine', 'haende', 'fuesse', 'ring1', 'ring2', 'amulett', 'umhang'];

export const CLASSES = {
  krieger: {
    name: 'Krieger',
    primary: { str: 12, agi: 6, int: 3, sta: 10 },
    growth: { str: 2, agi: 1, int: 0, sta: 2 },
    weapon: { name: 'Abgenutztes Schwert', dmg: 10 },
    abilities: ['heroic_strike', 'whirlwind', 'shield_block', 'execute'],
  },
};

const emptyEquipment = () => Object.fromEntries(SLOTS.map((s) => [s, null]));

export function createHero(classId) {
  const c = CLASSES[classId];
  if (!c) throw new Error(`Unbekannte Klasse: ${classId}`);
  const hero = {
    id: 'hero', name: c.name, side: 'hero', classId, level: 1,
    xp: 0, pendingDrafts: 0,
    primaryBase: { ...c.primary },
    baseArmor: 30, baseWeaponDmg: c.weapon.dmg,
    equipment: emptyEquipment(), inventory: [],
    talentMods: { str: 0, agi: 0, int: 0, sta: 0, crit: 0, ap: 0, armor: 0, hp: 0 },
    talents: [],
    resource: { type: 'rage', value: 0, max: 100 },
    abilities: [...c.abilities], cooldowns: {},
    autoAttackEvery: 2000, autoAttackTimer: 2000,
    ai: null, telegraph: null, blocking: 0, alive: true,
    maxHp: 0, hp: 0, ap: 0, weaponDmg: 0, critChance: 0, armor: 0,
    weapon: c.weapon, primary: { ...c.primary },
  };
  recomputeHero(hero);
  hero.hp = hero.maxHp;
  return hero;
}

// Derives all combat stats from base + level + equipped affixes + talent mods,
// preserving the current HP ratio. Called after any of those change.
export function recomputeHero(hero) {
  const ratio = hero.maxHp ? hero.hp / hero.maxHp : 1;
  const p = { ...hero.primaryBase };
  const tm = hero.talentMods;
  p.str += tm.str; p.agi += tm.agi; p.int += tm.int; p.sta += tm.sta;
  let crit = tm.crit, ap = tm.ap, armor = tm.armor, hp = tm.hp;
  let weaponDmg = hero.baseWeaponDmg;
  for (const slot of SLOTS) {
    const it = hero.equipment[slot];
    if (!it) continue;
    const a = it.affixes || {};
    p.str += a.str || 0; p.agi += a.agi || 0; p.int += a.int || 0; p.sta += a.sta || 0;
    crit += a.crit || 0; ap += a.ap || 0; armor += a.armor || 0; hp += a.hp || 0;
    if (slot === 'waffe' && it.weaponDmg) weaponDmg = it.weaponDmg;
  }
  const d = computeDerived(p, hero.level, { dmg: weaponDmg, bonusAp: ap });
  hero.primary = p;
  hero.maxHp = d.maxHp + hp;
  hero.ap = d.ap;
  hero.critChance = d.critChance + crit;
  hero.armor = hero.baseArmor + armor;
  hero.weaponDmg = weaponDmg;
  hero.hp = Math.max(1, Math.round(hero.maxHp * ratio));
  return hero;
}
