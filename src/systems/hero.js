import { computeDerived } from './stats.js';

const CLASSES = {
  krieger: {
    name: 'Krieger', primary: { str: 12, agi: 6, int: 3, sta: 10 },
    weapon: { name: 'Abgenutztes Schwert', dmg: 10, bonusAp: 0 },
    abilities: ['heroic_strike', 'whirlwind', 'shield_block', 'execute'],
  },
};

export function createHero(classId) {
  const c = CLASSES[classId];
  if (!c) throw new Error(`Unbekannte Klasse: ${classId}`);
  const d = computeDerived(c.primary, 1, c.weapon);
  return {
    id: 'hero', name: c.name, side: 'hero', classId, level: 1,
    maxHp: d.maxHp, hp: d.maxHp, armor: 30, ap: d.ap, weaponDmg: d.weaponDmg,
    critChance: d.critChance,
    resource: { type: 'rage', value: 0, max: 100 },
    abilities: [...c.abilities], cooldowns: {},
    autoAttackEvery: 2000, autoAttackTimer: 2000,
    ai: null, telegraph: null, blocking: 0, alive: true,
    weapon: c.weapon, primary: c.primary,
  };
}
