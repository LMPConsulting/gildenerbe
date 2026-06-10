import { BUILDINGS } from '../data/buildings.js';
import { recomputeHero } from './hero.js';

export const buildingLevel = (meta, id) => (meta.buildings && meta.buildings[id]) || 0;

export const buildingCost = (id, level) =>
  Math.round(BUILDINGS[id].baseCost * Math.pow(BUILDINGS[id].costMult, level));

// Spend Erbe to raise a building one level. Returns true on success.
export function buyBuilding(meta, id) {
  const lvl = buildingLevel(meta, id);
  if (lvl >= BUILDINGS[id].maxLevel) return false;
  const cost = buildingCost(id, lvl);
  if (meta.erbe < cost) return false;
  meta.erbe -= cost;
  meta.buildings[id] = lvl + 1;
  return true;
}

function starterWeapon(lvl) {
  return {
    id: 'starter_waffe', name: 'Gehärtetes Schwert', slot: 'waffe', rarity: 'gruen',
    ilvl: 2 + lvl * 2, weaponDmg: 10 + lvl * 4, affixes: { str: lvl },
  };
}

// Apply persistent Gildenhalle bonuses to a freshly created hero.
export function applyMetaToHero(hero, meta) {
  const train = buildingLevel(meta, 'trainingshalle');
  if (train > 0) {
    hero.primaryBase.str += train * 2;
    hero.primaryBase.agi += train;
    hero.primaryBase.sta += train * 2;
  }
  const gruft = buildingLevel(meta, 'heldengruft');
  if (gruft > 0) {
    hero.talentMods.str += gruft * 2;
    hero.talentMods.sta += gruft * 2;
    hero.talentMods.crit += gruft * 0.01;
  }
  recomputeHero(hero);
  hero.hp = hero.maxHp;
  const waffen = buildingLevel(meta, 'waffenkammer');
  if (waffen > 0) hero.inventory.push(starterWeapon(waffen));
  return hero;
}
