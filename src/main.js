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
import { mountFishingScreen } from './ui/fishingScreen.js';
import { mountCookingScreen } from './ui/cookingScreen.js';
import { mountEnchantScreen } from './ui/enchantScreen.js';
import { CLASSES, CLASS_IDS } from './data/classes.js';
import { RARITY, RARITY_ORDER } from './data/affixes.js';
import { addMat } from './systems/materials.js';
import { ensureChest } from './systems/chest.js';
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

document.addEventListener('pointerdown', () => initAudio(), { once: true });

const app = document.getElementById('app');
const storage = createWebStorage();

let account = loadGame(storage) || createInitialState();
if (!account.meta) account = createInitialState();
if (!account.createdAt) account.createdAt = Date.now();
if (!account.materials) account.materials = {};
ensureChest(account);
let unmountScreen = null, baseHandle = null;

function save() { account.lastSaved = Date.now(); saveGame(storage, account); }
function clear() {
  if (unmountScreen) { unmountScreen(); unmountScreen = null; }
  if (baseHandle) { baseHandle.unmount(); baseHandle = null; }
  app.innerHTML = '';
}
const sellValue = (it) => Math.max(1, (RARITY_ORDER.indexOf(it.rarity) + 1) * (it.ilvl || 1) * 2);

function computeOffline() {
  const last = account.lastSaved || 0;
  if (!last) return null;
  const secs = computeElapsedSeconds(last, Date.now(), offlineCapSeconds(account.meta));
  const erbe = offlineErbe(account.meta, secs);
  if (erbe > 0) { account.meta.erbe += erbe; return { secs, erbe }; }
  return null;
}

function boot() {
  if (!account.tutorialSeen) { clear(); mountTutorial(app, { onDone: () => { account.tutorialSeen = true; save(); boot(); } }); return; }
  const off = computeOffline();
  const mission = resolveMissionIfDone(account, Date.now());
  if (mission && mission.item) { account.missionStash = account.missionStash || []; account.missionStash.push(mission.item); }
  if (off || mission) {
    clear();
    const mins = off ? Math.round(off.secs / 60) : 0;
    app.innerHTML = `<div class="overlay win"><h2>Während du weg warst</h2>
      ${off ? `<div class="stat">~${mins} Min · Schatzkammer: <b>+${off.erbe} Erbe</b></div>` : ''}
      ${mission ? `<div class="stat">Mission zurück: <b>+${mission.erbe} Erbe</b>${mission.item ? ` · <span style="color:${RARITY[mission.item.rarity].color}">${mission.item.name}</span>` : ''}</div>` : ''}
      </div><button id="ok">Zur Basis</button>`;
    document.getElementById('ok').onclick = home; save();
  } else home();
}

// --- home: visual base + hub stations ---
function home() {
  clear();
  playMusic('town');
  const baseRoot = document.createElement('div'); app.appendChild(baseRoot);
  const stationRoot = document.createElement('div'); stationRoot.className = 'station-bar'; app.appendChild(stationRoot);
  baseHandle = mountBaseScreen(baseRoot, account, {
    onOpenBuilding: (id) => { if (id === 'gildenhalle') return openMainHall(); mountBuildingPanel(app, account, id, { onChanged: refreshBase }); },
    onNewHero: chooseClass,
    onMissions: () => mountMissionsPanel(app, account, { onChanged: refreshBase }),
    onCodex: openCodex,
  });
  renderStations(stationRoot);
}
function refreshBase() { save(); baseHandle && baseHandle.refresh(); }

function renderStations(root) {
  root.innerHTML = `<div class="station-gold">${account.gold || 0} Gold · ${account.chest.length} in Truhe</div>
    <div class="station-btns">
      <button data-st="fish">🎣 Angeln</button>
      <button data-st="cook">🍳 Kochen</button>
      <button data-st="ench">✨ Verzaubern</button>
      <button data-st="chest">📦 Truhe</button>
    </div>`;
  root.querySelector('[data-st="fish"]').onclick = () => openStation((r) => mountFishingScreen(r, account, { onClose: home, onChanged: save }));
  root.querySelector('[data-st="cook"]').onclick = () => openStation((r) => mountCookingScreen(r, account, { onClose: home, onChanged: save }));
  root.querySelector('[data-st="ench"]').onclick = () => { account.enchantables = [...account.chest]; openStation((r) => mountEnchantScreen(r, account, { onClose: home, onChanged: save })); };
  root.querySelector('[data-st="chest"]').onclick = openChest;
}
function openStation(mountFn) { clear(); const r = document.createElement('div'); r.className = 'station-screen'; app.appendChild(r); unmountScreen = mountFn(r) || null; }

function openChest() {
  const ov = document.createElement('div'); ov.className = 'panel-overlay'; app.appendChild(ov);
  const render = () => {
    ov.innerHTML = `<div class="panel-box"><h3>Truhe der Gilde (${account.chest.length})</h3>
      <p class="panel-desc">Hier liegt klassenübergreifende Beute — ein neuer Held nimmt sie über „Held → Truhe" mit. Verkaufe, was du nicht brauchst.</p>
      <div class="chest-list">${account.chest.length ? account.chest.map((it, i) => `<div class="mission-row"><div><b style="color:${RARITY[it.rarity].color}">${it.name}</b><small>${it.armorType ? it.armorType + ' · ' : ''}iLvl ${it.ilvl}${it.classReq ? ' · ' + it.classReq[0] : ''}</small></div><button data-sell="${i}">Verkaufen ${sellValue(it)}g</button></div>`).join('') : '<div class="panel-desc dim">leer</div>'}</div>
      <button class="ghost" id="ch-close">Schließen</button></div>`;
    ov.querySelectorAll('[data-sell]').forEach((b) => b.onclick = () => { const it = account.chest.splice(+b.dataset.sell, 1)[0]; account.gold = (account.gold || 0) + sellValue(it); save(); render(); refreshBase(); });
    ov.querySelector('#ch-close').onclick = () => { ov.remove(); };
  };
  render();
}

function openMainHall() {
  const ov = document.createElement('div'); ov.className = 'panel-overlay';
  ov.innerHTML = `<div class="panel-box"><h3>Haupthaus · Basis ${account.base.generation}</h3>
    <p class="panel-desc">Zustand: <b>${account.base.hp}/${account.base.maxHp} HP</b> · Mauer Stufe ${account.base.wallLevel || 0}</p>
    <div class="btn-row"><button id="mh-chronik">Chronik (${account.chronik.punkte} P)</button><button id="mh-mauer">Mauer &amp; Reparatur</button></div>
    <button class="ghost" id="mh-close">Schließen</button></div>`;
  app.appendChild(ov);
  ov.querySelector('#mh-chronik').onclick = () => { ov.remove(); mountChronikPanel(app, account, { onChanged: refreshBase }); };
  ov.querySelector('#mh-mauer').onclick = () => { ov.remove(); mountBuildingPanel(app, account, 'mauer', { onChanged: refreshBase }); };
  ov.querySelector('#mh-close').onclick = () => ov.remove();
}
function openCodex() { clear(); mountCodexScreen(app, { onClose: home }); }

// --- class selection before a run ---
function chooseClass() {
  if (account.base.underAttack) return defenseBattle();
  clear();
  const ov = document.createElement('div'); ov.className = 'overlay'; ov.style.maxWidth = '520px';
  ov.innerHTML = `<h2>Neuer Held</h2><div class="class-pick">${CLASS_IDS.map((id) => {
    const c = CLASSES[id];
    return `<button class="class-card" data-cls="${id}"><b>${c.name}</b><small>${c.armorType} · ${c.primaryStat.toUpperCase()}</small><span>${c.blurb}</span></button>`;
  }).join('')}</div>`;
  app.appendChild(ov);
  const back = document.createElement('button'); back.className = 'ghost'; back.textContent = 'Zurück'; back.onclick = home; app.appendChild(back);
  ov.querySelectorAll('.class-card').forEach((b) => b.onclick = () => beginRun(b.dataset.cls));
}

function beginRun(classId) {
  const food = account.pendingFood ? { stat: account.pendingFood.stat, value: account.pendingFood.value } : null;
  const run = createRun(classId, undefined, account.meta, { foodBuff: food });
  if (account.pendingFood) { account.pendingFood.runsLeft -= 1; if (account.pendingFood.runsLeft <= 0) account.pendingFood = null; }
  if (account.missionStash && account.missionStash.length) { run.hero.inventory.push(...account.missionStash); account.missionStash = []; }
  window.__run = run;
  playFloor(run);
}

function dungeonHandlers(run) {
  return {
    onEnd: (result) => {
      unmountScreen = null;
      const killed = window.__dungeon.state.enemies.filter((e) => !e.unit.alive).map((e) => e.unit);
      const rewards = result === 'cleared' ? run.grantRewards(killed) : null;
      const outcome = run.onFloorEnd(result);
      if (outcome === 'cleared' || outcome === 'fallen') finishRun(run, outcome); else showInterstitial(run, rewards);
    },
    onEvent: () => openChallenge(run),
  };
}

function playFloor(run) {
  clear();
  const floor = run.currentFloor();
  const header = document.createElement('div'); header.className = 'run-header';
  header.innerHTML = `<b>${run.zone.name}</b> &middot; Ebene ${run.index + 1}/${run.zone.floors.length} &middot; ${run.hero.name} St. ${run.hero.level}${floor.kind === 'boss' ? ' &middot; <span style="color:#e06b5e">BOSS</span>' : ''}`;
  app.appendChild(header);
  const arena = document.createElement('div'); app.appendChild(arena); run._arena = arena;
  playMusic(floor.kind === 'boss' ? 'boss' : 'explore');
  const dungeon = createDungeon({ hero: run.hero, floorDef: floor, seed: run.floorSeed() });
  window.__dungeon = dungeon;
  dungeon.on((e) => {
    if (e.type === 'damage') playSfx(e.crit ? 'crit' : 'hit');
    else if (e.type === 'loot') { const item = run.rollChestLoot(); playSfx('loot', { rarity: item ? item.rarity : 'gruen' }); }
    else if (e.type === 'telegraphResolve' && !e.hit) playSfx('block');
  });
  unmountScreen = mountDungeonScreen(arena, dungeon, dungeonHandlers(run));
}

function openChallenge(run) {
  if (unmountScreen) { unmountScreen(); unmountScreen = null; }
  const arena = run._arena; const seed = run.floorSeed() + 31;
  const kind = (run.index + run.hero.level) % 3;
  const back = () => { arena.innerHTML = ''; unmountScreen = mountDungeonScreen(arena, window.__dungeon, dungeonHandlers(run)); };
  const reward = (quality) => { playSfx('puzzleSolve'); const n = quality >= 0.9 ? 2 : 1; for (let i = 0; i < n; i++) run.rollChestLoot(); account.meta.erbe += Math.round(5 * quality); save(); back(); };
  arena.innerHTML = '';
  if (kind === 0) unmountScreen = mountRunePuzzleScreen(arena, { difficulty: run.index >= 2 ? 3 : 2, seed, onSolve: reward, onClose: back });
  else if (kind === 1) unmountScreen = mountChessScreen(arena, { seed, movesToWin: run.index >= 2 ? 2 : 1, onSolve: reward, onClose: back });
  else unmountScreen = mountSudokuScreen(arena, { seed, onSolve: reward, onClose: back });
}

function showInterstitial(run, rewards) {
  clear();
  const hero = run.hero;
  if (rewards) { if (rewards.leveled) playSfx('levelUp'); else if (rewards.drops.length) playSfx('loot', { rarity: rewards.drops[0].rarity }); }
  const drops = rewards && rewards.drops.length ? rewards.drops.map((d) => `<div class="drop" style="color:${RARITY[d.rarity].color}">${d.name}</div>`).join('') : '<div class="dim">keine Beute</div>';
  const flag = hero.inventory.length || hero.pendingDrafts ? ' •' : '';
  app.innerHTML = `<div class="overlay win"><h2>Ebene geschafft!</h2>
    <div class="stat">${run.index}/${run.zone.floors.length} Ebenen bezwungen</div>
    ${rewards ? `<div class="stat">+${rewards.xp} XP${rewards.leveled ? ` &middot; <b>Stufe ${hero.level}!</b>` : ''}</div>` : ''}
    <div class="stat">HP <b>${Math.round(hero.hp)}/${hero.maxHp}</b></div><div class="drops">${drops}</div>
    ${hero.pendingDrafts > 0 ? '<div class="stat dim">Talent verfügbar — öffne „Held"</div>' : ''}</div>
    <div class="btn-row"><button id="char">Held${flag}</button><button id="shop">Werkstatt</button><button id="next">Weiter</button></div>`;
  document.getElementById('char').onclick = () => openCharacter(run, rewards);
  document.getElementById('shop').onclick = () => { clear(); mountWorkshopScreen(app, run, { onClose: () => showInterstitial(run, rewards) }); };
  document.getElementById('next').onclick = () => playFloor(run);
}

function openCharacter(run, rewards) { clear(); mountCharacterScreen(app, run.hero, { onClose: () => showInterstitial(run, rewards), account }); }

// --- run end: economy (materials banked, junk sold), Erbe, raid ticker ---
function finishRun(run, kind) {
  for (const [k, v] of Object.entries(run.materials)) if (v > 0) addMat(account.materials, k, v);
  let gold = 8 + run.index * 6 + (kind === 'cleared' ? 25 : 0);
  for (const it of [...run.hero.inventory, ...Object.values(run.hero.equipment).filter(Boolean)]) gold += sellValue(it);
  account.gold = (account.gold || 0) + gold;
  const erbe = computeErbe(run.hero, run.index, account.meta);
  account.meta.erbe += erbe;
  account.stats.totalRuns += 1;
  account.stats.bestZone = Math.max(account.stats.bestZone || 0, run.index);
  const won = kind === 'cleared';
  let chronikLine = '';
  if (won) { const cp = chronikOnZoneClear(); account.chronik.punkte += cp; chronikLine = `<div class="stat">Chronik: <b>+${cp} Punkte</b></div>`; }
  const raidPending = tickRaidCounter(account);
  save(); playMusic('victory'); playSfx(won ? 'levelUp' : 'coin'); clear();
  app.innerHTML = `<div class="overlay ${won ? 'win' : 'lose'}"><h2>${won ? 'Eichhain bezwungen!' : 'Gefallen'}</h2>
    <div class="stat">${won ? `Zone 1 gemeistert · ${run.hero.name} St. ${run.hero.level}` : `Auf Ebene ${run.index + 1}/${run.zone.floors.length} gefallen.`}</div>
    <div class="stat">Geerntet: <b>+${erbe} Erbe</b> · <b>+${gold} Gold</b></div>${chronikLine}
    <div class="stat dim">Materialien in die Basis eingezahlt.</div>
    ${raidPending ? '<div class="stat" style="color:#e06b5e">⚔ Ein Überfall steht bevor!</div>' : ''}</div>
    <button id="tohall" class="primary">Zur Basis</button>`;
  document.getElementById('tohall').onclick = home;
}

function defenseBattle() {
  clear(); playMusic('boss');
  const header = document.createElement('div'); header.className = 'run-header';
  header.innerHTML = `<b style="color:#e06b5e">⚔ ÜBERFALL!</b> &middot; Verteidige die Basis &middot; Mauer St. ${account.base.wallLevel || 0}`;
  app.appendChild(header);
  const arena = document.createElement('div'); app.appendChild(arena);
  const hero = createHero('krieger'); applyMetaToHero(hero, account.meta); applyWallBonus(hero, account);
  const wave = createRaidWave(account, makeRng(1000 + (account.stats.totalRuns || 0)));
  const sim = createCombat({ hero, enemies: wave, seed: 99 + (account.stats.totalRuns || 0) });
  window.__defense = sim;
  sim.on((e) => { if (e.type === 'damage') playSfx(e.crit ? 'crit' : 'hit'); });
  unmountScreen = mountCombatScreen(arena, sim, {
    onEnd: (result) => {
      unmountScreen = null;
      const out = resolveRaid(account, result === 'won');
      if (out.baseDestroyed) {
        const earned = destroyBase(account); save(); playSfx('coin'); clear();
        app.innerHTML = `<div class="overlay lose"><h2>Die Basis ist gefallen!</h2>
          <div class="stat">Räuber haben alles niedergebrannt — auch die Truhe.</div>
          <div class="stat">In die Chronik eingegangen: <b>+${earned} Punkte</b></div>
          <div class="stat dim">Basis ${account.base.generation} beginnt — stärker durch die Chronik.</div></div>
          <button id="tohall" class="primary">Neu aufbauen</button>`;
        document.getElementById('tohall').onclick = home; return;
      }
      save(); clear(); playMusic(out.won ? 'victory' : 'town'); if (out.won) playSfx('levelUp');
      app.innerHTML = `<div class="overlay ${out.won ? 'win' : 'lose'}"><h2>${out.won ? 'Basis verteidigt!' : 'Überfall durchgebrochen'}</h2>
        ${out.won ? `<div class="stat">Beute erbeutet: <b>+${out.erbe} Erbe</b></div>` : `<div class="stat">Basis nahm <b>${out.baseDamage} Schaden</b> (${account.base.hp}/${account.base.maxHp} HP).</div><div class="stat dim">Repariere im Haupthaus.</div>`}</div>
        <button id="tohall" class="primary">Zur Basis</button>`;
      document.getElementById('tohall').onclick = home;
    },
  });
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
setInterval(save, 15000);
window.__account = account; window.__save = save;
boot();
