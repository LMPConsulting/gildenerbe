import { recomputeHero, CLASSES } from './hero.js';

export const LEVEL_CAP = 10;
export const xpForLevel = (level) => Math.round(100 * Math.pow(level, 1.5));

// Adds XP, applying as many level-ups as fit. Each level grants class stat
// growth and queues a talent draft; the hero is fully healed if it levelled.
export function addXp(hero, amount) {
  hero.xp += amount;
  let leveled = 0;
  while (hero.level < LEVEL_CAP && hero.xp >= xpForLevel(hero.level)) {
    hero.xp -= xpForLevel(hero.level);
    hero.level += 1;
    leveled += 1;
    const g = CLASSES[hero.classId].growth;
    hero.primaryBase.str += g.str;
    hero.primaryBase.agi += g.agi;
    hero.primaryBase.int += g.int;
    hero.primaryBase.sta += g.sta;
    hero.pendingDrafts += 1;
  }
  if (leveled) { recomputeHero(hero); hero.hp = hero.maxHp; }
  return leveled;
}
