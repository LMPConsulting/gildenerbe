import { createRun } from './run.js';
import { createDungeon } from './systems/dungeonSim.js';
import { mountDungeonScreen } from './ui/dungeonScreen.js';
import { mountCombatScreen } from './ui/combatScreen.js';
import { createCombat } from './systems/combatSim.js';
import { createHero } from './systems/hero.js';
import { applyMetaToHero } from './systems/gildenhalle.js';
import { mountCharacterScreen } from './ui/characterScreen.js';
import { mountWorkshopScreen } from './ui/workshopScreen.js';
import { mountBaseScreen } from './ui/baseScreen.js';
import { mountBuildingPanel, mountMissionsPanel, mountChronikPanel } from './ui/panels.js';
import { mountTutorial, mountCodexScreen } from './ui/tutorialScreen.js';
import { mountRunePuzzleScreen } from './ui/runePuzzleScreen.js';
import { mountChessScreen } from './ui/chessScreen.js';
import { mountSudokuScreen } from './ui/sudokuScreen.js';
import { RARITY } from './data/affixes.js';
import { createWebStorage } from './core/storage.js';
import { loadGame, saveGame } from './core/save.js';
import { createInitialState } from './core/state.js';
import { computeErbe, offlineErbe, offlineCapSeconds } from './systems/erbe.js';
import { computeElapsedSeconds } from './core/time.js';
import { makeRng } from './core/rng.js';
import { tickRaidCounter, createRaidWave, applyWallBonus, resolveRaid } from './systems/defense.js';
import { destroyBase, chronikOnZoneClear } from './systems/chronik.js';
import { resolveMissionIfDone } from './systems/missions.js';
import { initAudio, playMusic, playSfx } from './audio/index.js';

// Mobile-safe audio unlock: first tap/click anywhere initialises the context.
document.addEventListener('pointerdown', () => initAudio(), { once: true });

const app = document.getElementById('app');
const storage = createWebStorage();

// --- account (persistent, migrated by save.js) ---
let account = loadGame(storage) || createInitialState();
if (!account.meta) account = createInitialState();
if (!account.createdAt) account.createdAt = Date.now();
let unmountScreen = null;
let baseHandle = null;

function save() { account.lastSaved = Date.now(); saveGame(storage, account); }
function clear() {
  if (unmountScreen) { unmountScreen(); unmountScreen = null; }
  if (baseHandle) { baseHandle.unmount(); baseHandle = null; }
  app.innerHTML = '';
}

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
  if (!account.tutorialSeen) {
    clear();
    mountTutorial(app, { onDone: () => { account.tutorialSeen = true; save(); boot(); } });
    return;
  }
  const off = computeOffline();
  const mission = resolveMissionIfDone(account, Date.now());
  if (mission && mission.item) {
    account.missionStash = account.missionStash || [];
    account.missionStash.push(mission.item);
  }
  if (off || mission) {
    clear();
    const mins = off ? Math.round(off.secs / 60) : 0;
    app.innerHTML = `
      <div class="overlay win">
        <h2>Während du weg warst</h2>
        ${off ? `<div class="stat">~${mins} Min · Schatzkammer: <b>+${off.erbe} Erbe</b></div>` : ''}
        ${mission ? `<div class="stat">Mission zurück: <b>+${mission.erbe} Erbe</b>${mission.item ? ` · <span style="color:${RARITY[mission.item.rarity].color}">${mission.item.name}</span>` : ''}</div>` : ''}
      </div>
      <button id="ok">Zur Basis</button>`;
    document.getElementById('ok').onclick = home;
    save();
  } else {
    home();
  }
}

// --- home: the visual base ---
function home() {
  clear();
  playMusic('town');
  baseHandle = mountBaseScreen(app, account, {
    onOpenBuilding: (id) => {
      if (id === 'gildenhalle') return openMainHall();
      mountBuildingPanel(app, account, id, { onChanged: () => { save(); baseHandle && baseHandle.refresh(); } });
    },
    onNewHero: startRun,
    onMissions: () => mountMissionsPanel(app, account, { onChanged: () => { save(); baseHandle && baseHandle.refresh(); } }),
    onCodex: openCodex,
  });
}

// Main hall: Chronik (meta-meta) + wall/repairs live here.
function openMainHall() {
  const ov = document.createElement('div');
  ov.className = 'panel-overlay';
  ov.innerHTML = `
    <div class="panel-box">
      <h3>Haupthaus · Basis ${account.base.generation}</h3>
      <p class="panel-desc">Zustand: <b>${account.base.hp}/${account.base.maxHp} HP</b> · Mauer Stufe ${account.base.wallLevel || 0}</p>
      <div class="btn-row">
        <button id="mh-chronik">Chronik (${account.chronik.punkte} P)</button>
        <button id="mh-mauer">Mauer &amp; Reparatur</button>
      </div>
      <button class="ghost" id="mh-close">Schließen</button>
    </div>`;
  app.appendChild(ov);
  const done = () => { save(); baseHandle && baseHandle.refresh(); };
  ov.querySelector('#mh-chronik').onclick = () => { ov.remove(); mountChronikPanel(app, account, { onChanged: done }); };
  ov.querySelector('#mh-mauer').onclick = () => { ov.remove(); mountBuildingPanel(app, account, 'mauer', { onChanged: done }); };
  ov.querySelector('#mh-close').onclick = () => ov.remove();
}

function openCodex() {
  clear();
  mountCodexScreen(app, { onClose: home });
}

// --- starting out: raid first if one is pending ---
function startRun() {
  if (account.base.underAttack) return defenseBattle();
  const run = createRun('krieger', undefined, account.meta);
  // items brought home by mission scouts go to the new hero
  if (account.missionStash && account.missionStash.length) {
    run.hero.inventory.push(...account.missionStash);
    account.missionStash = [];
  }
  window.__run = run;
  playFloor(run);
}

// --- dungeon floors ---
function playFloor(run) {
  clear();
  const floor = run.currentFloor();
  const header = document.createElement('div');
  header.className = 'run-header';
  header.innerHTML = `<b>${run.zone.name}</b> &middot; Ebene ${run.index + 1}/${run.zone.floors.length} &middot; Stufe ${run.hero.level}${floor.kind === 'boss' ? ' &middot; <span style="color:#e06b5e">BOSS</span>' : ''}`;
  app.appendChild(header);
  const arena = document.createElement('div');
  app.appendChild(arena);

  playMusic(floor.kind === 'boss' ? 'boss' : 'explore');
  const dungeon = createDungeon({ hero: run.hero, floorDef: floor, seed: run.floorSeed() });
  window.__dungeon = dungeon;

  dungeon.on((e) => {
    if (e.type === 'damage') playSfx(e.crit ? 'crit' : 'hit');
    else if (e.type === 'loot') {
      const item = run.rollChestLoot();
      playSfx('loot', { rarity: item ? item.rarity : 'gruen' });
    } else if (e.type === 'telegraphResolve' && !e.hit) playSfx('block');
  });

  unmountScreen = mountDungeonScreen(arena, dungeon, {
    onEnd: (result) => {
      unmountScreen = null;
      const killed = dungeon.state.enemies.filter((e) => !e.unit.alive).map((e) => e.unit);
      const rewards = result === 'cleared' ? run.grantRewards(killed) : null;
      const outcome = run.onFloorEnd(result);
      if (outcome === 'cleared' || outcome === 'fallen') finishRun(run, outcome);
      else showInterstitial(run, rewards);
    },
    onEvent: () => openChallenge(run, dungeon, arena),
  });
}

// Challenge rooms: rotate rune puzzle / chess / sudoku. The dungeon sim is
// paused simply by unmounting its screen; state persists and we remount after.
function openChallenge(run, dungeon, arena) {
  if (unmountScreen) { unmountScreen(); unmountScreen = null; }
  const kind = (run.index + run.hero.level) % 3;
  const seed = run.floorSeed() + 31;
  const back = () => {
    arena.innerHTML = '';
    unmountScreen = mountDungeonScreen(arena, dungeon, {
      onEnd: (result) => {
        unmountScreen = null;
        const killed = dungeon.state.enemies.filter((e) => !e.unit.alive).map((e) => e.unit);
        const rewards = result === 'cleared' ? run.grantRewards(killed) : null;
        const outcome = run.onFloorEnd(result);
        if (outcome === 'cleared' || outcome === 'fallen') finishRun(run, outcome);
        else showInterstitial(run, rewards);
      },
      onEvent: () => openChallenge(run, dungeon, arena),
    });
  };
  const reward = (quality) => {
    playSfx('puzzleSolve');
    const items = quality >= 0.9 ? 2 : 1;
    for (let i = 0; i < items; i++) run.rollChestLoot();
    account.meta.erbe += Math.round(4 * quality);
    save();
    back();
  };
  arena.innerHTML = '';
  if (kind === 0) {
    const hard = run.index >= 2;
    unmountScreen = mountRunePuzzleScreen(arena, { size: hard ? 6 : 5, pairs: hard ? 4 : 3, onSolve: reward, onClose: back });
  } else if (kind === 1) {
    unmountScreen = mountChessScreen(arena, { seed, movesToWin: run.index >= 2 ? 2 : 1, onSolve: reward, onClose: back });
  } else {
    unmountScreen = mountSudokuScreen(arena, { seed, size: run.index >= 2 ? 6 : 4, onSolve: reward, onClose: back });
  }
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
      <h2>Ebene geschafft!</h2>
      <div class="stat">${run.index}/${run.zone.floors.length} Ebenen bezwungen</div>
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
  document.getElementById('next').onclick = () => playFloor(run);
}

function openCharacter(run, rewards) {
  clear();
  mountCharacterScreen(app, run.hero, { onClose: () => showInterstitial(run, rewards) });
}

function openWorkshop(run, rewards) {
  clear();
  mountWorkshopScreen(app, run, { onClose: () => showInterstitial(run, rewards) });
}

// --- run end -> Erbe -> raid counter -> base ---
function finishRun(run, kind) {
  const erbe = computeErbe(run.hero, run.index, account.meta);
  account.meta.erbe += erbe;
  account.stats.totalRuns += 1;
  account.stats.bestZone = Math.max(account.stats.bestZone || 0, run.index);
  const won = kind === 'cleared';
  let chronikLine = '';
  if (won) {
    const cp = chronikOnZoneClear();
    account.chronik.punkte += cp;
    chronikLine = `<div class="stat">Chronik: <b>+${cp} Punkte</b></div>`;
  }
  const raidPending = tickRaidCounter(account);
  save();
  playMusic('victory');
  if (won) playSfx('levelUp'); else playSfx('coin');
  clear();
  app.innerHTML = `
    <div class="overlay ${won ? 'win' : 'lose'}">
      <h2>${won ? 'Eichhain bezwungen!' : 'Gefallen'}</h2>
      <div class="stat">${won ? `Zone 1 gemeistert · Stufe ${run.hero.level}` : `Auf Ebene ${run.index + 1}/${run.zone.floors.length} gefallen (Stufe ${run.hero.level}).`}</div>
      <div class="stat">Geerntet: <b>+${erbe} Erbe</b></div>
      ${chronikLine}
      ${raidPending ? '<div class="stat" style="color:#e06b5e">⚔ Späher melden: Ein Überfall auf die Basis steht bevor!</div>' : ''}
    </div>
    <button id="tohall" class="primary">Zur Basis</button>`;
  document.getElementById('tohall').onclick = home;
}

// --- base defense (raid waves use the classic side-view battle) ---
function defenseBattle() {
  clear();
  playMusic('boss');
  const header = document.createElement('div');
  header.className = 'run-header';
  header.innerHTML = `<b style="color:#e06b5e">⚔ ÜBERFALL!</b> &middot; Verteidige die Basis &middot; Mauer St. ${account.base.wallLevel || 0}`;
  app.appendChild(header);
  const arena = document.createElement('div');
  app.appendChild(arena);

  const hero = createHero('krieger');
  applyMetaToHero(hero, account.meta);
  applyWallBonus(hero, account);
  const wave = createRaidWave(account, makeRng(1000 + (account.stats.totalRuns || 0)));
  const sim = createCombat({ hero, enemies: wave, seed: 99 + (account.stats.totalRuns || 0) });
  window.__defense = sim;
  sim.on((e) => { if (e.type === 'damage') playSfx(e.crit ? 'crit' : 'hit'); });

  unmountScreen = mountCombatScreen(arena, sim, {
    onEnd: (result) => {
      unmountScreen = null;
      const out = resolveRaid(account, result === 'won');
      if (out.baseDestroyed) {
        const earned = destroyBase(account);
        save();
        playSfx('coin');
        clear();
        app.innerHTML = `
          <div class="overlay lose">
            <h2>Die Basis ist gefallen!</h2>
            <div class="stat">Die Räuber haben alles niedergebrannt.</div>
            <div class="stat">Deine Taten gehen in die Chronik ein: <b>+${earned} Punkte</b></div>
            <div class="stat dim">Basis ${account.base.generation} beginnt — stärker durch die Chronik.</div>
          </div>
          <button id="tohall" class="primary">Neu aufbauen</button>`;
        document.getElementById('tohall').onclick = home;
        return;
      }
      save();
      clear();
      playMusic(out.won ? 'victory' : 'town');
      if (out.won) playSfx('levelUp');
      app.innerHTML = `
        <div class="overlay ${out.won ? 'win' : 'lose'}">
          <h2>${out.won ? 'Basis verteidigt!' : 'Überfall durchgebrochen'}</h2>
          ${out.won ? `<div class="stat">Beute der Räuber erbeutet: <b>+${out.erbe} Erbe</b></div>` : `<div class="stat">Die Basis nahm <b>${out.baseDamage} Schaden</b> (${account.base.hp}/${account.base.maxHp} HP).</div><div class="stat dim">Repariere sie im Haupthaus.</div>`}
        </div>
        <button id="tohall" class="primary">Zur Basis</button>`;
      document.getElementById('tohall').onclick = home;
    },
  });
}

// autosave on background (mobile) + interval
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
setInterval(save, 15000);

// debug handles (console)
window.__account = account;
window.__save = save;

boot();
