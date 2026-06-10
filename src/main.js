import { createRun } from './run.js';
import { mountCombatScreen } from './ui/combatScreen.js';
import { mountCharacterScreen } from './ui/characterScreen.js';
import { RARITY } from './data/affixes.js';

const app = document.getElementById('app');
let unmountCombat = null;

function clear() {
  if (unmountCombat) { unmountCombat(); unmountCombat = null; }
  app.innerHTML = '';
}

function showStart() {
  clear();
  app.innerHTML = `
    <div class="panel">
      <h1>GILDENERBE</h1>
      <div class="stat">Zone: <b>Eichhain</b></div>
      <div class="stat">Klasse: <b>Krieger</b></div>
    </div>
    <button id="start">Neuer Held: Krieger</button>
  `;
  document.getElementById('start').onclick = startRun;
}

function startRun() {
  playEncounter(createRun('krieger'));
}

function playEncounter(run) {
  clear();
  const header = document.createElement('div');
  header.className = 'run-header';
  header.innerHTML = `<b>${run.zone.name}</b> &middot; Begegnung ${run.index + 1}/${run.zone.encounters.length} &middot; Stufe ${run.hero.level}`;
  app.appendChild(header);

  const arena = document.createElement('div');
  app.appendChild(arena);

  const sim = run.buildSim();
  window.__combat = sim;
  window.__run = run;
  unmountCombat = mountCombatScreen(arena, sim, {
    onEnd: (result) => {
      unmountCombat = null;
      const rewards = result === 'won' ? run.grantRewards(sim.state.enemies) : null;
      const outcome = run.onCombatEnd(result);
      if (outcome === 'cleared' || outcome === 'fallen') showEnd(run, outcome);
      else showInterstitial(run, rewards);
    },
  });
}

function showInterstitial(run, rewards) {
  clear();
  const hero = run.hero;
  const drops = rewards && rewards.drops.length
    ? rewards.drops.map((d) => `<div class="drop" style="color:${RARITY[d.rarity].color}">${d.name}</div>`).join('')
    : '<div class="dim">keine Beute</div>';
  const flag = hero.inventory.length || hero.pendingDrafts ? ' •' : '';
  app.innerHTML = `
    <div class="overlay win">
      <h2>Sieg!</h2>
      <div class="stat">${run.index}/${run.zone.encounters.length} Begegnungen geschafft</div>
      ${rewards ? `<div class="stat">+${rewards.xp} XP${rewards.leveled ? ` &middot; <b>Stufe ${hero.level}!</b>` : ''}</div>` : ''}
      <div class="stat">HP <b>${Math.round(hero.hp)}/${hero.maxHp}</b></div>
      <div class="drops">${drops}</div>
      ${hero.pendingDrafts > 0 ? '<div class="stat dim">Talent verfügbar — öffne „Held"</div>' : ''}
    </div>
    <div class="btn-row">
      <button id="char">Held${flag}</button>
      <button id="next">Weiter</button>
    </div>
  `;
  document.getElementById('char').onclick = () => openCharacter(run, rewards);
  document.getElementById('next').onclick = () => playEncounter(run);
}

function openCharacter(run, rewards) {
  clear();
  mountCharacterScreen(app, run.hero, { onClose: () => showInterstitial(run, rewards) });
}

function showEnd(run, kind) {
  clear();
  const won = kind === 'cleared';
  app.innerHTML = `
    <div class="overlay ${won ? 'win' : 'lose'}">
      <h2>${won ? 'Eichhain bezwungen!' : 'Gefallen'}</h2>
      <div class="stat">${won
        ? `Zone 1 gemeistert &middot; Stufe ${run.hero.level}`
        : `Bei Begegnung ${run.index + 1}/${run.zone.encounters.length} gefallen (Stufe ${run.hero.level}).`}</div>
      <div class="stat dim">Erbe &amp; Reroll folgen in Milestone 5</div>
    </div>
    <button id="again">Neuer Held</button>
  `;
  document.getElementById('again').onclick = showStart;
}

showStart();
