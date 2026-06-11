import { createHero } from './systems/hero.js';
import { makeEnemy } from './data/enemies.js';
import { ZONE1 } from './data/zones.js';
import { makeRng } from './core/rng.js';
import { addXp } from './systems/leveling.js';
import { rollLoot } from './systems/loot.js';
import { makeBag, addMat } from './systems/materials.js';
import { applyMetaToHero } from './systems/gildenhalle.js';

// A single hero's journey through a zone's dungeon floors. The hero carries
// across floors (hp persists, healed between floors). Erbe on run end.
export function createRun(classId = 'krieger', zone = ZONE1, meta = null, opts = {}) {
  const hero = createHero(classId, { foodBuff: opts.foodBuff });
  if (meta) applyMetaToHero(hero, meta);
  const lootRng = makeRng(7777);

  const run = {
    hero,
    zone,
    index: 0,
    result: null, // null | 'cleared' | 'fallen'
    materials: makeBag(),

    currentFloor() {
      return zone.floors[run.index];
    },

    floorSeed() {
      return 5000 + run.index * 17;
    },

    // XP + loot for slain enemy units (passed from the dungeon's kill list).
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

    // Guaranteed chest loot (elite-grade) + a few mats.
    rollChestLoot() {
      const dummy = makeEnemy('raeuber');
      dummy.elite = true; // bumps rarity + guarantees a drop
      const item = rollLoot(dummy, lootRng);
      addMat(run.materials, 'kupfererz', 2);
      if (item) hero.inventory.push(item);
      return item;
    },

    onFloorEnd(result) {
      if (result === 'cleared') {
        hero.hp = Math.min(hero.maxHp, hero.hp + Math.round(hero.maxHp * 0.45));
        hero.resource.value = 0;
        hero.cooldowns = {};
        hero.autoAttackTimer = hero.autoAttackEvery;
        hero.blocking = 0;
        hero.alive = true;
        run.index++;
        if (run.index >= zone.floors.length) run.result = 'cleared';
      } else {
        run.result = 'fallen';
      }
      return run.result;
    },
  };
  return run;
}
