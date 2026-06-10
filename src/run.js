import { createHero } from './systems/hero.js';
import { makeEnemy } from './data/enemies.js';
import { createCombat } from './systems/combatSim.js';
import { ZONE1 } from './data/zones.js';
import { makeRng } from './core/rng.js';
import { addXp } from './systems/leveling.js';
import { rollLoot } from './systems/loot.js';
import { makeBag, addMat } from './systems/materials.js';

// A single hero's journey through a zone. The hero instance carries across
// encounters (hp persists, healed between fights). Erbe/reroll = Plan 5.
export function createRun(classId = 'krieger', zone = ZONE1) {
  const hero = createHero(classId);
  const lootRng = makeRng(7777);

  const run = {
    hero,
    zone,
    index: 0,
    result: null, // null | 'cleared' | 'fallen'
    materials: makeBag(),

    currentEncounter() {
      return zone.encounters[run.index];
    },

    buildSim() {
      const enemies = run.currentEncounter().map(makeEnemy);
      return createCombat({ hero, enemies, seed: 1000 + run.index });
    },

    // XP + loot for slain enemies. Call on a won combat (before onCombatEnd).
    grantRewards(enemies) {
      const xp = enemies.reduce((s, e) => s + (e.xp || 0), 0);
      const leveled = addXp(hero, xp);
      const drops = enemies.map((e) => rollLoot(e, lootRng)).filter(Boolean);
      hero.inventory.push(...drops);
      const mats = {};
      for (const e of enemies) {
        const ore = e.boss ? 5 : e.elite ? 3 : 1;
        addMat(run.materials, 'kupfererz', ore);
        addMat(run.materials, 'kraeuter', 1);
        mats.kupfererz = (mats.kupfererz || 0) + ore;
        mats.kraeuter = (mats.kraeuter || 0) + 1;
      }
      return { xp, leveled, drops, mats };
    },

    onCombatEnd(result) {
      if (result === 'won') {
        hero.hp = Math.min(hero.maxHp, hero.hp + Math.round(hero.maxHp * 0.45));
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
