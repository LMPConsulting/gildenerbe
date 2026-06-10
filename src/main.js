import { createRun } from './run.js';
import { mountCombatScreen } from './ui/combatScreen.js';

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
  header.innerHTML = `<b>${run.zone.name}</b> &middot; Begegnung ${run.index + 1}/${run.zone.encounters.length}`;
  app.appendChild(header);

  const arena = document.createElement('div');
  app.appendChild(arena);

  const sim = run.buildSim();
  window.__combat = sim;
  window.__run = run;
  unmountCombat = mountCombatScreen(arena, sim, {
    onEnd: (result) => {
      unmountCombat = null;
      const outcome = run.onCombatEnd(result);
      if (outcome === 'cleared' || outcome === 'fallen') showEnd(run, outcome);
      else showInterstitial(run);
    },
  });
}

function showInterstitial(run) {
  clear();
  const hp = Math.max(0, Math.round(run.hero.hp));
  app.innerHTML = `
    <div class="overlay win">
      <h2>Sieg!</h2>
      <div class="stat">${run.index}/${run.zone.encounters.length} Begegnungen geschafft</div>
      <div class="stat">HP: <b>${hp}/${run.hero.maxHp}</b> &middot; +30% geheilt</div>
    </div>
    <button id="next">Weiter</button>
  `;
  document.getElementById('next').onclick = () => playEncounter(run);
}

function showEnd(run, kind) {
  clear();
  const won = kind === 'cleared';
  app.innerHTML = `
    <div class="overlay ${won ? 'win' : 'lose'}">
      <h2>${won ? 'Eichhain bezwungen!' : 'Gefallen'}</h2>
      <div class="stat">${won
        ? 'Du hast Zone 1 gemeistert.'
        : `Bei Begegnung ${run.index + 1}/${run.zone.encounters.length} gefallen.`}</div>
      <div class="stat dim">Erbe &amp; Reroll folgen in Milestone 5</div>
    </div>
    <button id="again">Neuer Held</button>
  `;
  document.getElementById('again').onclick = showStart;
}

showStart();
