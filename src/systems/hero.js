import { computeDerived } from './stats.js';
import { CLASSES, RESOURCES } from '../data/classes.js';

export { CLASSES }; // re-exported for leveling.js / talentDraft.js compatibility

export const SLOTS = ['waffe', 'kopf', 'brust', 'beine', 'haende', 'fuesse', 'ring1', 'ring2', 'amulett', 'umhang'];

const emptyEquipment = () => Object.fromEntries(SLOTS.map((s) => [s, null]));

// opts.foodBuff = { stat, value } applies a temporary pre-run meal bonus.
export function createHero(classId, opts = {}) {
  const c = CLASSES[classId];
  if (!c) throw new Error(`Unbekannte Klasse: ${classId}`);
  const res = RESOURCES[c.resourceType];
  const hero = {
    id: 'hero', name: c.name, side: 'hero', classId, level: 1,
    armorType: c.armorType, primaryStat: c.primaryStat, weaponKind: c.weapon.kind,
    xp: 0, pendingDrafts: 0,
    primaryBase: { ...c.primary }, growth: { ...c.growth },
    baseArmor: c.baseArmor ?? 30, baseWeaponDmg: c.weapon.dmg,
    equipment: emptyEquipment(), inventory: [],
    talentMods: { str: 0, agi: 0, int: 0, sta: 0, crit: 0, ap: 0, armor: 0, hp: 0, spellPower: 0 },
    foodMods: opts.foodBuff ? { [opts.foodBuff.stat]: opts.foodBuff.value } : {},
    talents: [],
    resource: {
      type: c.resourceType,
      value: c.resourceType === 'rage' ? 0 : res.max, // casters/energy start full
      max: res.max, regenPerSec: res.regenPerSec, fromHit: res.fromHit,
    },
    abilities: [...c.abilities], cooldowns: {},
    autoAttackEvery: c.weapon.kind === 'ranged' ? 1800 : (classId === 'schurke' ? 1500 : 2000),
    autoAttackTimer: 2000,
    ai: null, telegraph: null, blocking: 0, alive: true,
    maxHp: 0, hp: 0, ap: 0, spellPower: 0, weaponDmg: 0, critChance: 0, armor: 0,
    weapon: { ...c.weapon }, primary: { ...c.primary },
  };
  recomputeHero(hero);
  hero.hp = hero.maxHp;
  return hero;
}

// Derives all combat stats from base (level growth is baked into primaryBase by
// leveling.js) + equipped affixes + talent + food mods, preserving HP ratio.
export function recomputeHero(hero) {
  const ratio = hero.maxHp ? hero.hp / hero.maxHp : 1;
  const p = { ...hero.primaryBase };
  const tm = hero.talentMods, fm = hero.foodMods || {};
  const add = (k) => (tm[k] || 0) + (fm[k] || 0);
  p.str += add('str'); p.agi += add('agi'); p.int += add('int'); p.sta += add('sta');
  let crit = add('crit'), ap = add('ap'), armor = add('armor'), hp = add('hp'), sp = add('spellPower');
  let weaponDmg = hero.baseWeaponDmg;
  for (const slot of SLOTS) {
    const it = hero.equipment[slot];
    if (!it) continue;
    const a = it.affixes || {};
    p.str += a.str || 0; p.agi += a.agi || 0; p.int += a.int || 0; p.sta += a.sta || 0;
    crit += a.crit || 0; ap += a.ap || 0; armor += a.armor || 0; hp += a.hp || 0; sp += a.spellPower || 0;
    if (slot === 'waffe' && it.weaponDmg) weaponDmg = it.weaponDmg;
  }
  const d = computeDerived(p, hero.level, { dmg: weaponDmg, bonusAp: ap, bonusSp: sp });
  hero.primary = p;
  hero.maxHp = d.maxHp + hp;
  hero.ap = d.ap;
  hero.spellPower = d.spellPower;
  hero.critChance = d.critChance + crit;
  hero.armor = hero.baseArmor + armor;
  hero.weaponDmg = weaponDmg;
  hero.hp = Math.max(1, Math.round(hero.maxHp * ratio));
  return hero;
}

// Power scalar for a unit's damage, by class scaling. Used by the combat sim
// so a mage scales off spellPower and a martial off weapon+AP.
export function abilityBaseDamage(hero, ab) {
  if (ab.spellCoef) return hero.spellPower * ab.spellCoef + hero.level * 2;
  return hero.weaponDmg * (ab.weaponCoef || 1) + hero.ap * (ab.apCoef || 0);
}
