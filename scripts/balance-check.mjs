// Balance harness: auto-plays a full Zone-1 run, greedily equipping upgrades
// and drafting talents, to check whether a geared hero can clear the zone.
// Run: node scripts/balance-check.mjs
import { createRun } from '../src/run.js';
import { equipItem } from '../src/systems/equipment.js';
import { draftTalents, applyTalent } from '../src/systems/talentDraft.js';
import { makeRng } from '../src/core/rng.js';

function score(it) {
  if (!it) return -1;
  const a = it.affixes || {};
  return (a.str || 0) * 2 + (a.agi || 0) * 2 + (a.sta || 0) * 2 + (a.ap || 0)
    + (a.armor || 0) * 0.2 + (a.crit || 0) * 1000 + (it.weaponDmg ? it.weaponDmg * 3 : 0);
}

function equipUpgrades(hero) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const it of [...hero.inventory]) {
      if (score(it) > score(hero.equipment[it.slot])) { equipItem(hero, it); changed = true; }
    }
  }
}

// Simulate competent play: react with abilities + block instead of pure auto-attack.
function autoFight(sim) {
  const h = sim.state.hero;
  const cd = (id) => h.cooldowns[id] || 0;
  let t = 0;
  while (!sim.state.result && t < 120000) {
    const foes = sim.state.enemies.filter((e) => e.alive);
    if (foes.some((e) => e.telegraph) && cd('shield_block') <= 0 && h.resource.value >= 10) sim.queueAbility('shield_block');
    else if (foes[0] && foes[0].hp / foes[0].maxHp <= 0.2 && cd('execute') <= 0 && h.resource.value >= 25) sim.queueAbility('execute');
    else if (foes.length >= 2 && cd('whirlwind') <= 0 && h.resource.value >= 25) sim.queueAbility('whirlwind');
    else if (h.resource.value >= 15) sim.queueAbility('heroic_strike');
    sim.step(200);
    t += 200;
  }
}

const run = createRun('krieger');
const draftRng = makeRng(123);
const log = [];
let guard = 0;
while (run.result === null && guard++ < 12) {
  const sim = run.buildSim();
  autoFight(sim);
  const res = sim.state.result || 'lost';
  if (res === 'won') {
    run.grantRewards(sim.state.enemies);
    equipUpgrades(run.hero);
    while (run.hero.pendingDrafts > 0) applyTalent(run.hero, draftTalents(draftRng, 3)[0].id);
  }
  const foeHp = sim.state.enemies.map((e) => `${Math.round(e.hp)}/${e.maxHp}`).join(',');
  log.push(`idx${run.index} ${sim.state.enemies.map((e) => e.id).join('+')} -> ${res} | Lv${run.hero.level} hp ${Math.round(run.hero.hp)}/${run.hero.maxHp} ap${run.hero.ap} wpn${run.hero.weaponDmg} | foeHp ${foeHp}`);
  run.onCombatEnd(res);
}
console.log(log.join('\n'));
console.log('FINAL:', run.result, '· Level', run.hero.level);
