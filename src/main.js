import { createRun } from './run.js';
import { mountCombatScreen } from './ui/combatScreen.js';
import { mountCharacterScreen } from './ui/characterScreen.js';
import { mountWorkshopScreen } from './ui/workshopScreen.js';
import { mountGildenhalle } from './ui/gildenhalleScreen.js';
import { RARITY } from './data/affixes.js';
import { createWebStorage } from './core/storage.js';
import { loadGame, saveGame } from './core/save.js';
import { createInitialState } from './core/state.js';
import { computeErbe, offlineErbe, offlineCapSeconds } from './systems/erbe.js';
import { computeElapsedSeconds } from './core/time.js';
import { initAudio, playMusic, playSfx } from './audio/index.js';

// Mobile-safe audio unlock: first tap/click anywhere initialises the context.
document.addEventListener('pointerdown', () => initAudio(), { once: true });

const app = document.getElementById('app');
const storage = createWebStorage();

// --- account (persistent) ---
let account = loadGame(storage) || createInitialState();
if (!account.meta) account = createInitialState();
if (!account.stats) account.stats = { totalRuns: 0, bestZone: 0, playTicks: 0 };
if (!account.createdAt) account.createdAt = Date.now();
let unmountCombat = null;

function save() { account.lastSaved = Date.now(); saveGame(storage, account); }
function clear() { if (unmountCombat) { unmountCombat(); unmountCombat = null; } app.innerHTML = ''; }

// --- offline yield on boot ---
function computeOffline() {
  const last = account.lastSaved || 0;
  if (!last) return null;
  const secs = computeElapsedSeconds(last, Date.now(), offlineCapSeconds(account.meta));
  const erbe = offlineErbe(account.meta, secs);
  if (erbe > 0) { account.meta.erbe += erbe; return { secs, erbe }; }
  return null;
}

function boot() {
  const off = computeOffline();
  if (off) {
    clear();
    const mins = Math.round(off.secs / 60);
    app.innerHTML = `
      <div class="overlay win">
        <h2>Während du weg warst</h2>
        <div class="stat">~${mins} Min · die Schatzkammer erwirtschaftete <b>+${off.erbe} Erbe</b></div>
      </div>
      <button id="ok">Zur Gildenhalle</button>`;
    document.getElementById('ok').onclick = home;
    save();
  } else {
    home();
  }
}

// --- home (Gildenhalle) ---
function home() {
  clear();
  playMusic('town');
  mountGildenhalle(app, account, { onNewHero: startRun, onSaved: save });
}

function startRun() {
  playEncounter(createRun('krieger', undefined, account.meta));
}

// --- a run ---
function playEncounter(run) {
  clear();
  const header = document.createElement('div');
  header.className = 'run-header';
  header.innerHTML = `<b>${run.zone.name}</b> &middot; Begegnung ${run.index + 1}/${run.zone.encounters.length} &middot; Stufe ${run.hero.level}`;
  app.appendChild(header);
  const arena = document.createElement('div');
  app.appendChild(arena);

  const sim = run.buildSim();
  playMusic(sim.state.enemies.some((e) => e.boss) ? 'boss' : 'explore');
  sim.on((e) => {
    if (e.type === 'damage') playSfx(e.crit ? 'crit' : 'hit');
    else if (e.type === 'telegraphResolve' && e.blocked) playSfx('block');
  });
  window.__combat = sim;
  window.__run = run;
  unmountCombat = mountCombatScreen(arena, sim, {
    onEnd: (result) => {
      unmountCombat = null;
      const rewards = result === 'won' ? run.grantRewards(sim.state.enemies) : null;
      const outcome = run.onCombatEnd(result);
      if (outcome === 'cleared' || outcome === 'fallen') finishRun(run, outcome);
      else showInterstitial(run, rewards);
    },
  });
}

function showInterstitial(run, rewards) {
  clear();
  const hero = run.hero;
  if (rewards) {
    if (rewards.leveled) playSfx('levelUp');
    else if (rewards.drops.length) playSfx('loot', { rarity: rewards.drops[0].rarity });
  }
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
      <button id="shop">Werkstatt</button>
      <button id="next">Weiter</button>
    </div>`;
  document.getElementById('char').onclick = () => openCharacter(run, rewards);
  document.getElementById('shop').onclick = () => openWorkshop(run, rewards);
  document.getElementById('next').onclick = () => playEncounter(run);
}

function openCharacter(run, rewards) {
  clear();
  mountCharacterScreen(app, run.hero, { onClose: () => showInterstitial(run, rewards) });
}

function openWorkshop(run, rewards) {
  clear();
  mountWorkshopScreen(app, run, { onClose: () => showInterstitial(run, rewards) });
}

// --- run end -> Erbe -> back to Gildenhalle ---
function finishRun(run, kind) {
  const erbe = computeErbe(run.hero, run.index, account.meta);
  account.meta.erbe += erbe;
  account.stats.totalRuns += 1;
  account.stats.bestZone = Math.max(account.stats.bestZone || 0, run.index);
  save();
  const won = kind === 'cleared';
  playMusic('victory');
  if (won) playSfx('levelUp'); else playSfx('coin');
  clear();
  app.innerHTML = `
    <div class="overlay ${won ? 'win' : 'lose'}">
      <h2>${won ? 'Eichhain bezwungen!' : 'Gefallen'}</h2>
      <div class="stat">${won ? `Zone 1 gemeistert · Stufe ${run.hero.level}` : `Bei Begegnung ${run.index + 1}/${run.zone.encounters.length} gefallen (Stufe ${run.hero.level}).`}</div>
      <div class="stat">Geerntet: <b>+${erbe} Erbe</b></div>
    </div>
    <button id="tohall" class="primary">Zur Gildenhalle</button>`;
  document.getElementById('tohall').onclick = home;
}

// autosave on background (mobile) + interval
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
setInterval(save, 15000);

// debug handles (console)
window.__account = account;
window.__save = save;

boot();
