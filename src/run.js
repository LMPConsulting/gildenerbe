import { createHero } from './systems/hero.js';
import { makeEnemy } from './data/enemies.js';
import { createCombat } from './systems/combatSim.js';
import { ZONE1 } from './data/zones.js';

// A single hero's journey through a zone. The hero instance carries across
// encounters (hp persists, healed between fights). Erbe/reroll = Plan 5.
export function createRun(classId = 'krieger', zone = ZONE1) {
  const hero = createHero(classId);
  const run = {
    hero,
    zone,
    index: 0,
    result: null, // null | 'cleared' | 'fallen'

    currentEncounter() {
      return zone.encounters[run.index];
    },

    buildSim() {
      const enemies = run.currentEncounter().map(makeEnemy);
      return createCombat({ hero, enemies, seed: 1000 + run.index });
    },

    onCombatEnd(result) {
      if (result === 'won') {
        // recover for the next fight
        hero.hp = Math.min(hero.maxHp, hero.hp + Math.round(hero.maxHp * 0.3));
        hero.resource.value = 0;
        hero.cooldowns = {};
        hero.autoAttackTimer = hero.autoAttackEvery;
        hero.blocking = 0;
        hero.alive = true;
        run.index++;
        if (run.index >= zone.encounters.length) run.result = 'cleared';
      } else {
        run.result = 'fallen';
      }
      return run.result;
    },
  };
  return run;
}
