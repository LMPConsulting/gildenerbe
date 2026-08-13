// Qwixx — Oberfläche für ein Handy, das zwischen zwei bis vier Leuten wandert.

import {
  COLORS, COLOR_LABEL, ROW_VALUES, LAST_INDEX, LOCK_MIN_CROSSES,
  MAX_PENALTIES, SCORE_TABLE,
  createGame, rollDice, submit, legalMoves, colorCombos, currentStep,
  whiteSum, rightmostCross, crossCount, playerScore, standings, endReason,
} from './engine.js';
import { netzAufbauen, netzMoeglich } from './netz.js';
import { qrZeichnen } from './qr.js';
import { funkAufbauen, scannerStarten, scannerMoeglich } from './funk.js';

const SAVE_KEY = 'qwixx.save.v1';
const PREFS_KEY = 'qwixx.prefs.v1';

const app = document.getElementById('app');

let game = null;
let ui = {
  screen: 'start',    // 'start' | 'game' | 'over'
  holder: null,       // wer das Handy gerade in der Hand hat
  viewPlayer: 0,      // wessen Blatt angezeigt wird
  pick: null,         // vorgemerktes Feld { color, index }
  rolling: false,
  overlay: null,      // 'rules' | 'menu'
  fresh: null,        // Schlüssel des zuletzt gezeichneten Kreuzes
  toast: null,
  modus: 'lokal',     // 'lokal' | 'online'
  meinIndex: 0,       // online: welcher Spieler dieses Gerät ist
  gastgeber: true,    // online: dieses Gerät rechnet
  netz: null,
  kopplung: null,
};
let prefs = { sound: true, names: ['Spieler 1', 'Spieler 2'] };

/* ---------------------------------------------------------------- Hilfen */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const cellKey = (pi, color, index) => `${pi}:${color}:${index}`;

function jitter(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return ((h % 13) - 6) * 0.9;   // −5.4° … +5.4°
}

function crossSvg(key, extra = '') {
  return `<svg class="x ${extra}" viewBox="0 0 24 24" aria-hidden="true"
    style="transform:rotate(${jitter(key).toFixed(1)}deg)">
    <path d="M5.5 5.5 18.5 18.5"/><path d="M18.5 5.5 5.5 18.5"/></svg>`;
}

const LOCK_SVG = `<svg class="lockico" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M7.5 10.5V7.2a4.5 4.5 0 0 1 9 0v3.3" fill="none" stroke="currentColor" stroke-width="2.4"/>
  <rect x="4.2" y="10.2" width="15.6" height="10.6" rx="2.4" fill="currentColor"/></svg>`;

const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function dieSvg(value, color) {
  const on = PIPS[value] || [];
  const cells = Array.from({ length: 9 }, (_, i) => `<i class="${on.includes(i) ? '' : 'off'}"></i>`).join('');
  const cls = color ? ` die--${color}` : '';
  const label = color ? `${COLOR_LABEL[color]}er Würfel` : 'weißer Würfel';
  return `<div class="die${cls}${ui.rolling ? ' die--rolling' : ''}" role="img" aria-label="${label}: ${value}">${cells}</div>`;
}

/* ------------------------------------------------------------------ Ton */

let audioCtx = null;
function beep(freq, dur = 0.06, type = 'square', gain = 0.05) {
  if (!prefs.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch { /* Ton ist Beiwerk */ }
}
const sfx = {
  tap: () => beep(660, 0.04, 'triangle', 0.04),
  cross: () => beep(880, 0.05, 'triangle', 0.06),
  rattle: () => { [420, 560, 380, 640].forEach((f, i) => setTimeout(() => beep(f, 0.035, 'square', 0.03), i * 90)); },
  lock: () => { beep(520, 0.09, 'sawtooth', 0.05); setTimeout(() => beep(780, 0.14, 'sawtooth', 0.05), 90); },
  penalty: () => beep(150, 0.22, 'sawtooth', 0.06),
  win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.13, 'triangle', 0.05), i * 110)),
};
const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch { /* egal */ } };

let toastTimer = null;
function setToast(msg) {
  ui.toast = msg;
  clearTimeout(toastTimer);
  if (msg) toastTimer = setTimeout(() => { ui.toast = null; render(); }, 2800);
}

/** Baut aus <style> und <script> der laufenden Seite wieder ein vollständiges Dokument. */
function seitenQuelltext(cssId, jsId, ersatzTitel) {
  const css = document.getElementById(cssId)?.textContent || '';
  const js = document.getElementById(jsId)?.textContent || '';
  if (!css || !js) return null;
  const kopf = typeof SEITENKOPF === 'string'
    ? SEITENKOPF
    : `<meta charset="utf-8"><title>${ersatzTitel}</title>`;
  return [
    '<!doctype html>', '<html lang="de">', '<head>',
    kopf,
    `<style id="${cssId}">`, css, '</style>', '</head>', '<body>',
    '<div id="app"></div>',
    `<script id="${jsId}">`, js, '<' + '/script>',
    '</body>', '</html>', ''
  ].join('\n');
}

function browserDownload(dateiname, html) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Speichert die laufende Seite als eigenständige HTML-Datei.
 * In der Claude-App läuft das über deren Speichern-Dialog (landet dann im
 * normalen Download-Ordner des Handys), sonst über einen Browser-Download.
 * Rückgabe: 'ok' | 'txt' | 'abgelehnt' | 'dev'
 */
async function seiteAlsDateiSichern(cssId, jsId, dateiname, ersatzTitel) {
  // Auf der Webseite liegt die Einzeldatei fertig daneben — dann einfach die holen.
  if (typeof OFFLINE_DATEI === 'string') {
    const a = document.createElement('a');
    a.href = OFFLINE_DATEI;
    a.download = dateiname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return 'ok';
  }
  const html = seitenQuelltext(cssId, jsId, ersatzTitel);
  if (!html) return 'dev';

  const dl = typeof window !== 'undefined' && window.claude ? window.claude.downloads : null;
  if (dl) {
    try {
      await dl.save({ filename: dateiname, data: html });
      return 'ok';
    } catch (fehler) {
      const code = fehler && fehler.code;
      if (code === 'declined') return 'abgelehnt';
      // Manche Ansichten erlauben kein .html — dann eben als Textdatei zum Umbenennen.
      if (code === 'rejected_extension' || code === 'extension_not_enabled') {
        try {
          await dl.save({ filename: dateiname.replace(/\.html$/, '') + '.txt', data: html });
          return 'txt';
        } catch (zweiterFehler) {
          if (zweiterFehler && zweiterFehler.code === 'declined') return 'abgelehnt';
        }
      }
      // alles andere: normaler Browser-Download als Rückfallebene
    }
  }
  browserDownload(dateiname, html);
  return 'ok';
}

/**
 * Gibt die Spieldatei an das Teilen-Menü des Handys weiter — damit landet sie
 * per Nearby Share, WhatsApp oder Bluetooth direkt auf dem zweiten Gerät.
 * Rückgabe: 'ok' | 'abgelehnt' | 'geht-nicht' | 'dev'
 */
async function spielTeilen(cssId, jsId, dateiname, titel) {
  // Auf der Webseite ist der Link das Nützlichste, was man weitergeben kann.
  if (typeof OFFLINE_DATEI === 'string') {
    try {
      if (navigator.share) {
        await navigator.share({ title: titel, url: location.href });
        return 'ok';
      }
      await navigator.clipboard.writeText(location.href);
      return 'kopiert';
    } catch (fehler) {
      return fehler && fehler.name === 'AbortError' ? 'abgelehnt' : 'geht-nicht';
    }
  }
  const html = seitenQuelltext(cssId, jsId, titel);
  if (!html) return 'dev';
  try {
    const datei = new File([html], dateiname, { type: 'text/html' });
    if (navigator.canShare && navigator.canShare({ files: [datei] })) {
      await navigator.share({ files: [datei], title: titel });
      return 'ok';
    }
  } catch (fehler) {
    if (fehler && fehler.name === 'AbortError') return 'abgelehnt';
  }
  return 'geht-nicht';
}

const TEILEN_TEXT = {
  ok: 'Weitergegeben',
  kopiert: 'Link kopiert',
  abgelehnt: 'Abgebrochen',
  'geht-nicht': 'Geht hier nicht — erst sichern, dann aus den Dateien teilen',
  dev: 'Geht nur in der fertigen Version',
};

const SICHER_TEXT = {
  ok: 'Gesichert — liegt in deinen Downloads',
  txt: 'Als .txt gesichert — bitte in %NAME% umbenennen',
  abgelehnt: 'Abgebrochen — nichts gespeichert',
  dev: 'Geht nur in der fertigen Version',
};

/* ------------------------------------------------------------ Speichern */

function save() {
  if (ui.modus === 'online') return;      // auf zwei Geräten führt der Gastgeber Buch
  try {
    if (game && game.phase !== 'over') {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ game, holder: ui.holder }));
    } else {
      localStorage.removeItem(SAVE_KEY);
    }
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch { /* privater Modus o. ä. */ }
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) prefs = { ...prefs, ...JSON.parse(raw) };
  } catch { /* Standardwerte behalten */ }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.game?.v === 1 && data.game.phase !== 'over') return data;
  } catch { /* kaputter Spielstand wird ignoriert */ }
  return null;
}

/* -------------------------------------------------------------- Ablauf */

/* ---------------------------------------------------- Zwei Handys, ein Spiel */

/** Der Gastgeber rechnet; das andere Gerät schickt nur seine Absicht hinüber. */
function sendeStand() {
  ui.netz?.senden({ typ: 'stand', game });
}

function nachrichtVerarbeiten(m) {
  if (m.typ === 'stand' && !ui.gastgeber) {
    game = m.game;
    ui.screen = game.phase === 'over' ? 'over' : 'game';
    ui.pick = null;
    ui.holder = ui.meinIndex;
    ui.viewPlayer = ui.meinIndex;
    render();
    return;
  }
  if (m.typ === 'namen' && !ui.gastgeber) {
    ui.meinIndex = m.meinIndex === 1 ? 1 : 0;
    return;
  }
  if (m.typ === 'aktion' && ui.gastgeber && game) {
    // Der Gast darf nur handeln, wenn er wirklich an der Reihe ist.
    if (requiredPlayer() !== gegenIndex()) return;
    if (m.name === 'wuerfeln') {
      if (game.phase !== 'roll') return;
      rollDice(game);
    } else if (m.name === 'submit') {
      const wunsch = m.zug;
      const treffer = wunsch
        ? legalMoves(game).find((z) => z.color === wunsch.color && z.index === wunsch.index)
        : null;
      if (wunsch && !treffer) return;
      submit(game, treffer || null);
    } else {
      return;
    }
    afterMutation();
  }
}

const gegenIndex = () => (ui.meinIndex === 0 ? 1 : 0);

/** Zug ausführen (Gastgeber) oder hinüberschicken (Gast). */
function tun(name, zug) {
  if (ui.modus === 'online' && !ui.gastgeber) {
    ui.netz?.senden({ typ: 'aktion', name, zug: zug || null });
    ui.pick = null;
    render();
    return false;
  }
  return true;
}

function kopplungAbbrechen() {
  ui.netz?.schliessen();
  ui.netz = null;
  ui.kopplung = null;
  ui.modus = 'lokal';
  ui.meinIndex = 0;
  ui.gastgeber = true;
  render();
}

async function netzStarten(gastgeber, code) {
  ui.modus = 'online';
  ui.gastgeber = gastgeber;
  ui.meinIndex = gastgeber ? 0 : 1;
  ui.kopplung = { schritt: 'raum', gastgeber, code: '', hinweis: '', fehler: '' };
  render();

  ui.netz = netzAufbauen({
    gastgeber,
    code,
    aufZustand: (text, verbunden) => {
      if (verbunden) return verbindungSteht();
      if (ui.kopplung) { ui.kopplung.hinweis = text; render(); }
      return undefined;
    },
    aufNachricht: nachrichtVerarbeiten,
    aufCode: (c) => { if (ui.kopplung) { ui.kopplung.code = c; render(); } },
  });

  try {
    await ui.netz.bereit;
  } catch (fehler) {
    if (!ui.kopplung) return;
    ui.kopplung.fehler = fehler.message || 'Das hat nicht geklappt.';
    ui.kopplung.schritt = gastgeber ? 'raum' : 'code';
    render();
  }
}

function verbindungSteht() {
  ui.kopplung = null;
  if (ui.gastgeber) {
    game = createGame(prefs.names.slice(0, 2));
    ui.screen = 'game';
    ui.pick = null;
    ui.fresh = null;
    ui.holder = ui.meinIndex;
    ui.viewPlayer = ui.meinIndex;
    ui.netz?.senden({ typ: 'namen', meinIndex: 1 });
    sendeStand();
  }
  render();
}

function requiredPlayer() {
  if (!game || game.phase === 'over') return null;
  if (game.phase === 'roll') return game.active;
  const step = currentStep(game);
  return step ? step.p : null;
}

/** Mitspieler ohne jede Möglichkeit überspringen — spart sinnlose Übergaben. */
function autoSkip() {
  let skipped = [];
  while (game.phase === 'decide') {
    const step = currentStep(game);
    if (!step || step.p === game.active) break;
    if (legalMoves(game).length > 0) break;
    skipped.push(game.players[step.p].name);
    submit(game, null);
  }
  if (skipped.length) {
    setToast(`${skipped.join(' & ')} konnte nichts ankreuzen`);
  }
}

function afterMutation() {
  autoSkip();
  if (game.phase === 'over') {
    ui.screen = 'over';
    ui.overlay = null;
    sfx.win();
  }
  const need = requiredPlayer();
  if (ui.modus === 'online') {
    // Auf zwei Geräten wandert nichts — jeder bleibt auf seinem eigenen Blatt.
    ui.holder = ui.meinIndex;
    ui.viewPlayer = ui.meinIndex;
    if (need !== ui.meinIndex) ui.pick = null;
    if (ui.gastgeber) sendeStand();
    render();
    return;
  }
  if (need !== null && need !== ui.holder) ui.pick = null;
  else if (need !== null) ui.viewPlayer = need;
  save();
  render();
}

function startGame(names) {
  game = createGame(names);
  ui.holder = null;
  ui.viewPlayer = 0;
  ui.pick = null;
  ui.fresh = null;
  setToast(null);
  ui.screen = 'game';
  afterMutation();
}

function doRoll() {
  if (ui.rolling) return;
  if (!tun('wuerfeln')) return;
  ui.rolling = true;
  sfx.rattle();
  buzz(18);
  render();

  const spin = setInterval(() => {
    // Nur die Optik: echte Werte kommen erst beim Stoppen.
    game.dice = {
      w1: 1 + Math.floor(Math.random() * 6), w2: 1 + Math.floor(Math.random() * 6),
      red: game.lockedRows.red ? null : 1 + Math.floor(Math.random() * 6),
      yellow: game.lockedRows.yellow ? null : 1 + Math.floor(Math.random() * 6),
      green: game.lockedRows.green ? null : 1 + Math.floor(Math.random() * 6),
      blue: game.lockedRows.blue ? null : 1 + Math.floor(Math.random() * 6),
    };
    render();
  }, 75);

  setTimeout(() => {
    clearInterval(spin);
    ui.rolling = false;
    setToast(null);
    rollDice(game);
    afterMutation();
  }, 640);
}

function confirmPick() {
  const move = ui.pick && legalMoves(game).find((m) => m.color === ui.pick.color && m.index === ui.pick.index);
  if (!move) return;
  if (!tun('submit', { color: move.color, index: move.index })) return;
  const step = currentStep(game);
  ui.fresh = cellKey(step.p, move.color, move.index);
  ui.pick = null;
  setToast(null);
  const locking = move.index === LAST_INDEX;
  submit(game, move);
  if (locking) { sfx.lock(); buzz([20, 50, 30]); } else { sfx.cross(); buzz(14); }
  afterMutation();
}

function passStep() {
  if (!tun('submit', null)) return;
  const step = currentStep(game);
  const wasFehlwurf = step.p === game.active && step.kind === 'color' && !game.activeCrossed;
  ui.pick = null;
  setToast(null);
  submit(game, null);
  if (wasFehlwurf) { sfx.penalty(); buzz([30, 60, 30]); } else { sfx.tap(); }
  afterMutation();
}

/* ------------------------------------------------------- Startbildschirm */

function renderStart() {
  const resume = loadSave();
  const names = prefs.names.length >= 2 ? prefs.names : ['Spieler 1', 'Spieler 2'];

  app.innerHTML = `
    <div class="screen start">
      <h1 class="brand"><span>Q</span><span>w</span><span>i</span>x<span>x</span></h1>
      <p class="tagline">Das Würfelspiel für unterwegs — ein Handy, zwei bis vier Leute, kein Internet.</p>

      <div class="namelist" id="names">
        ${names.map((n, i) => nameRow(n, i)).join('')}
      </div>

      <div class="btnrow" style="margin-bottom:16px">
        <button class="btn btn--ghost" id="rmPlayer" ${names.length <= 2 ? 'disabled' : ''}>− Spieler</button>
        <button class="btn btn--ghost" id="addPlayer" ${names.length >= 4 ? 'disabled' : ''}>+ Spieler</button>
      </div>

      ${resume ? `<button class="btn btn--primary" id="resume">Angefangenes Spiel fortsetzen</button>
                  <button class="btn btn--ghost" id="start" style="margin-top:10px">Neues Spiel</button>`
               : `<button class="btn btn--primary" id="start">Spiel starten</button>`}

      <button class="btn btn--ghost" id="zweiGeraete" style="margin-top:10px">Auf zwei Handys</button>

      <button class="btn btn--quiet" id="rules" style="margin-top:12px">Spielregeln lesen</button>
    </div>`;

  const readNames = () => Array.from(app.querySelectorAll('.field'))
    .map((f, i) => (f.value.trim() || `Spieler ${i + 1}`));

  app.querySelector('#addPlayer').onclick = () => { prefs.names = [...readNames(), `Spieler ${readNames().length + 1}`]; save(); render(); };
  app.querySelector('#rmPlayer').onclick = () => { prefs.names = readNames().slice(0, -1); save(); render(); };
  app.querySelector('#rules').onclick = () => { ui.overlay = 'rules'; render(); };
  app.querySelector('#start').onclick = () => { prefs.names = readNames(); save(); startGame(readNames()); };
  app.querySelector('#zweiGeraete').onclick = () => {
    prefs.names = readNames().slice(0, 2); save();
    ui.kopplung = { schritt: 'rolle' };
    render();
  };
  if (resume) {
    app.querySelector('#resume').onclick = () => {
      game = resume.game;
      ui.holder = resume.holder;
      ui.screen = game.phase === 'over' ? 'over' : 'game';
      ui.pick = null;
      afterMutation();
    };
  }
}

function nameRow(name, i) {
  return `<div class="namerow">
    <span class="seat num">${i + 1}</span>
    <input class="field" type="text" maxlength="14" value="${esc(name)}"
           placeholder="Spieler ${i + 1}" aria-label="Name Spieler ${i + 1}" />
  </div>`;
}

/* ------------------------------------------------------------ Spielblatt */

function sheetHtml(pi, interactive) {
  const player = game.players[pi];
  const legal = interactive ? legalMoves(game) : [];
  const score = playerScore(player);

  const rows = COLORS.map((color) => {
    const row = player.rows[color];
    const edge = rightmostCross(row);
    const rowLocked = game.lockedRows[color];

    const cells = ROW_VALUES[color].map((value, index) => {
      const key = cellKey(pi, color, index);
      const crossed = row[index];
      const isLegal = legal.some((m) => m.color === color && m.index === index);
      const picked = ui.pick && ui.pick.color === color && ui.pick.index === index;
      const dead = !crossed && (rowLocked || index <= edge
        || (index === LAST_INDEX && crossCount(player, color) < LOCK_MIN_CROSSES));

      const cls = ['cell'];
      if (crossed) cls.push('cell--crossed');
      else if (dead) cls.push('cell--passed');
      if (isLegal && !picked) cls.push('cell--legal');
      if (picked) cls.push('cell--pick');

      const mark = crossed ? crossSvg(key, key === ui.fresh ? 'x--fresh' : '')
                 : picked ? crossSvg(key, 'x--ghost') : '';
      const tag = isLegal ? 'button' : 'div';
      const attrs = isLegal
        ? ` type="button" data-color="${color}" data-index="${index}" aria-label="${COLOR_LABEL[color]} ${value} ankreuzen"`
        : ' aria-hidden="false"';
      return `<${tag} class="${cls.join(' ')}"${attrs}>${value}${mark}</${tag}>`;
    }).join('');

    const lockKey = cellKey(pi, color, 'lock');
    const lockCls = ['cell', 'cell--lock'];
    if (!player.locks[color]) lockCls.push('cell--open');
    const lockMark = player.locks[color] ? crossSvg(lockKey, lockKey === ui.fresh ? 'x--fresh' : '') : '';

    return `<div class="row row--${color}${rowLocked ? ' row--locked' : ''}"
                 role="group" aria-label="Reihe ${COLOR_LABEL[color]}">
      ${cells}<div class="${lockCls.join(' ')}">${LOCK_SVG}${lockMark}</div></div>`;
  }).join('');

  const boxes = Array.from({ length: MAX_PENALTIES }, (_, i) => {
    const on = i < player.penalties;
    return `<span class="box${on ? ' on' : ''}">${on ? crossSvg(`p${pi}${i}`) : ''}</span>`;
  }).join('');

  return `<div class="sheet${interactive ? '' : ' sheet--readonly'}">
    ${rows}
    <div class="sheetfoot">
      <div class="penalties">
        <span class="lbl">Fehlwürfe</span>${boxes}
        ${player.penalties ? `<span class="lbl num">−${player.penalties * 5}</span>` : ''}
      </div>
      <span class="totalchip">${score.total} Pkt</span>
    </div>
  </div>`;
}

/* -------------------------------------------------------------- Spielsicht */

function renderGame() {
  const step = currentStep(game);
  const need = requiredPlayer();
  const owner = ui.holder;
  const viewingOther = ui.viewPlayer !== owner;
  const interactive = !viewingOther && !ui.rolling && game.phase === 'decide' && step && step.p === owner;
  const legal = interactive ? legalMoves(game) : [];

  const d = game.dice;
  const whiteDice = d ? `${dieSvg(d.w1)}<span class="plus">+</span>${dieSvg(d.w2)}` : `${dieSvg(1)}<span class="plus">+</span>${dieSvg(1)}`;
  const colorDice = COLORS.map((c) => (d && d[c] != null
    ? dieSvg(d[c], c)
    : `<div class="die die--${c} die--out" role="img" aria-label="${COLOR_LABEL[c]} ausgeschieden"></div>`)).join('');

  const showCombos = game.phase === 'decide' && step && step.kind === 'color' && !ui.rolling;
  const combos = showCombos ? colorCombos(game).map((k) => {
    const live = legal.some((m) => m.color === k.color && m.value === k.value);
    return `<span class="combo combo--${k.color}${live ? ' combo--live' : ''}">
      <b>${k.white}+${k.die}=${k.value}</b></span>`;
  }).join('') : '';

  const tabs = game.players.map((p, i) => {
    const cls = ['tab'];
    if (i === ui.viewPlayer) cls.push('tab--view');
    if (i === need) cls.push('tab--turn');
    return `<button class="${cls.join(' ')}" data-tab="${i}">
      <em>${esc(p.name)}</em><b>${playerScore(p).total}</b></button>`;
  }).join('');

  app.innerHTML = `
    <div class="screen screen--game">
      <header class="topbar">
        <div class="meta">
          <div class="turn">Runde ${game.turn} · ${esc(game.players[game.active].name)} würfelt</div>
          <div class="who">${headline(step, owner)}</div>
        </div>
        <div class="tools">
          <button class="tool" id="btnRules" aria-label="Regeln">?</button>
          <button class="tool" id="btnMenu" aria-label="Menü">⋯</button>
        </div>
      </header>

      <div class="tray">
        <div class="dicegroup">${whiteDice}</div>
        ${d && !ui.rolling ? `<div class="sumchip"><span>Weiße Summe</span><b>${whiteSum(game)}</b></div>` : ''}
        <div class="dicegroup">${colorDice}</div>
        ${combos ? `<div class="combos">${combos}</div>` : ''}
      </div>

      <div class="tabs">${tabs}</div>

      <div class="scroll">${sheetHtml(ui.viewPlayer, interactive)}</div>

      <div class="actions">
        <div class="hint">${hintText(step, owner, viewingOther, legal)}</div>
        ${actionButtons(step, owner, viewingOther, legal)}
      </div>
    </div>
    ${ui.toast ? `<div class="toast">${esc(ui.toast)}</div>` : ''}`;

  app.querySelector('#btnRules').onclick = () => { ui.overlay = 'rules'; render(); };
  app.querySelector('#btnMenu').onclick = () => { ui.overlay = 'menu'; render(); };
  app.querySelectorAll('[data-tab]').forEach((b) => {
    b.onclick = () => { ui.viewPlayer = Number(b.dataset.tab); ui.pick = null; sfx.tap(); render(); };
  });
  app.querySelectorAll('.cell[data-color]').forEach((b) => {
    b.onclick = () => {
      const pick = { color: b.dataset.color, index: Number(b.dataset.index) };
      ui.pick = (ui.pick && ui.pick.color === pick.color && ui.pick.index === pick.index) ? null : pick;
      sfx.tap(); buzz(8); render();
    };
  });
  app.querySelector('#btnRoll')?.addEventListener('click', doRoll);
  app.querySelector('#btnConfirm')?.addEventListener('click', confirmPick);
  app.querySelector('#btnClear')?.addEventListener('click', () => { ui.pick = null; sfx.tap(); render(); });
  app.querySelector('#btnPass')?.addEventListener('click', passStep);
  app.querySelector('#btnBack')?.addEventListener('click', () => { ui.viewPlayer = ui.holder; render(); });
}

function headline(step, owner) {
  if (game.phase === 'roll') return 'Würfeln';
  if (!step) return '';
  if (step.kind === 'white') return `Weiße Summe · ${esc(game.players[step.p].name)}`;
  return `Weiß + Farbe · nur ${esc(game.players[step.p].name)}`;
}

function hintText(step, owner, viewingOther, legal) {
  if (viewingOther) return `Du schaust auf das Blatt von <b>${esc(game.players[ui.viewPlayer].name)}</b>.`;
  if (ui.rolling) return 'Die Würfel rollen …';
  if (game.phase === 'roll') return 'Du bist am Zug — wirf alle Würfel.';
  if (!step) return '';

  if (ui.pick) {
    const v = ROW_VALUES[ui.pick.color][ui.pick.index];
    const lockNote = ui.pick.index === LAST_INDEX ? ' — das <b>sperrt die Reihe</b> für alle!' : '';
    return `<b>${COLOR_LABEL[ui.pick.color]} ${v}</b> ankreuzen${lockNote}`;
  }

  if (legal.length === 0) {
    return step.kind === 'white'
      ? 'Mit dieser Summe geht bei dir nichts mehr.'
      : 'Keine Kombination aus Weiß + Farbe passt.';
  }

  if (step.kind === 'white') {
    return `Summe <b>${whiteSum(game)}</b> — in <b>einer</b> beliebigen Reihe ankreuzen. Freiwillig.`;
  }
  return 'Nur du darfst jetzt einen weißen mit einem Farbwürfel kombinieren.';
}

function actionButtons(step, owner, viewingOther, legal) {
  if (viewingOther) return `<button class="btn btn--ghost" id="btnBack">Zurück zu meinem Blatt</button>`;
  if (ui.rolling) return `<button class="btn btn--primary" disabled>Würfeln …</button>`;
  if (game.phase === 'roll') return `<button class="btn btn--primary" id="btnRoll">Würfeln</button>`;
  if (!step) return '';

  if (ui.pick) {
    return `<div class="btnrow">
      <button class="btn btn--ghost" id="btnClear">Doch nicht</button>
      <button class="btn btn--primary" id="btnConfirm">Ankreuzen</button>
    </div>`;
  }

  const lastActiveStep = step.p === game.active && step.kind === 'color';
  const fehlwurf = lastActiveStep && !game.activeCrossed;

  if (legal.length === 0) {
    return `<button class="btn ${fehlwurf ? 'btn--danger' : 'btn--ghost'}" id="btnPass">
      ${fehlwurf ? 'Fehlwurf hinnehmen (−5)' : 'Weiter'}</button>`;
  }
  return `<button class="btn ${fehlwurf ? 'btn--danger' : 'btn--ghost'}" id="btnPass">
    ${fehlwurf ? 'Aussetzen — kostet Fehlwurf (−5)' : 'Aussetzen'}</button>`;
}

/* ------------------------------------------------------------- Übergabe */

/** Auf zwei Geräten wird nichts weitergereicht — man wartet einfach. */
function renderWarten(need) {
  const layer = document.createElement('div');
  layer.className = 'overlay handover';
  layer.innerHTML = `
    <div class="arrow" aria-hidden="true">⏳</div>
    <div class="lbl">Am Zug</div>
    <div class="name">${esc(game.players[need].name)}</div>
    <p class="task">Auf dem anderen Handy wird gerade gewürfelt oder angekreuzt.
      Sobald es weitergeht, springt dein Blatt von selbst um.</p>`;
  app.appendChild(layer);
}

/* ------------------------------------- Kopplung ohne Server: QR im selben WLAN */

/**
 * Direktverbindung zwischen zwei Handys. Braucht keinen Server, dafür ein
 * gemeinsames WLAN oder einen Hotspot — funktioniert damit auch im Flugzeug.
 * Nach außen sieht sie aus wie die Durchreiche: senden, verbunden, schliessen.
 */
async function funkStarten(gastgeber) {
  ui.modus = 'online';
  ui.gastgeber = gastgeber;
  ui.meinIndex = gastgeber ? 0 : 1;
  ui.kopplung = { schritt: 'moment', gastgeber, ueberQr: true, hinweis: '', fehler: '' };
  render();

  ui.netz = funkAufbauen({
    gastgeber,
    aufZustand: (text, verbunden) => {
      if (verbunden) return verbindungSteht();
      if (ui.kopplung && ui.kopplung.schritt !== 'scannen') {
        ui.kopplung.hinweis = text;
        render();
      }
      return undefined;
    },
    aufNachricht: nachrichtVerarbeiten,
  });

  if (gastgeber) {
    ui.kopplung.code = await ui.netz.eigenerCode();
    ui.kopplung.schritt = 'zeigen';
  } else {
    ui.kopplung.schritt = 'scannen';
  }
  render();
}

async function fremdenCodeAnnehmen(code) {
  const k = ui.kopplung;
  try {
    await ui.netz.codeLesen(code);
    if (!ui.kopplung) return;                  // war schon verbunden
    if (!k.gastgeber) {
      ui.kopplung.code = await ui.netz.eigenerCode();
      ui.kopplung.schritt = 'zeigen';
    } else {
      ui.kopplung.schritt = 'warten';
    }
    k.fehler = '';
  } catch (fehler) {
    if (!ui.kopplung) return;
    k.fehler = fehler.message || 'Der Code passt nicht.';
  }
  render();
}

/** Kopplung zweier Geräte — über das Netz oder direkt per QR. */
function renderKopplung() {
  const k = ui.kopplung;

  if (k.schritt === 'rolle') {
    app.innerHTML = `
      <div class="screen"><div class="wrap">
        <h2 class="h2">Auf zwei Handys</h2>
        <p class="lead">Beide spielen gleichzeitig, jeder auf seinem eigenen Gerät.
          Es gibt zwei Wege — nimm den, der zu eurer Lage passt.</p>
        ${netzMoeglich() ? `
        <div class="feldlabel">Über das Internet</div>
        <p class="lead">Egal wo ihr seid. Einer öffnet einen Raum, der andere tippt den Code ein.</p>
        <div class="knopfsaeule">
          <button class="btn btn--primary" id="netzWirt">Raum öffnen</button>
          <button class="btn btn--ghost" id="netzGast">Mit Code beitreten</button>
        </div>` : ''}
        <div class="feldlabel">Im selben WLAN oder Hotspot</div>
        <p class="lead">Ohne Server, direkt von Handy zu Handy — geht auch ohne Internet,
          etwa über einen Hotspot im Flugzeug. Ihr zeigt euch dafür QR-Codes.</p>
        <div class="knopfsaeule">
          <button class="btn btn--ghost" id="qrWirt">QR zeigen</button>
          <button class="btn btn--ghost" id="qrGast">QR scannen</button>
        </div>
        <div class="knopfsaeule">
          <button class="btn btn--quiet" id="abbruch">Doch an einem Handy</button>
        </div>
      </div></div>`;
    app.querySelector('#netzWirt')?.addEventListener('click', () => netzStarten(true));
    app.querySelector('#netzGast')?.addEventListener('click', () => {
      ui.kopplung = { schritt: 'code', gastgeber: false, code: '', fehler: '' };
      render();
    });
    app.querySelector('#qrWirt').onclick = () => funkStarten(true);
    app.querySelector('#qrGast').onclick = () => funkStarten(false);
    app.querySelector('#abbruch').onclick = kopplungAbbrechen;
    return;
  }

  if (k.schritt === 'moment') {
    app.innerHTML = `<div class="screen"><div class="wrap">
      <h2 class="h2">Einen Moment</h2>
      <p class="lead">Verbindungsdaten werden vorbereitet …</p></div></div>`;
    return;
  }

  if (k.schritt === 'warten') {
    app.innerHTML = `<div class="screen"><div class="wrap">
      <h2 class="h2">Verbinde …</h2>
      <p class="lead">${esc(k.hinweis || 'Die Handys suchen sich gerade.')}</p>
      <p class="lead">Dauert es länger als ein paar Sekunden, blockiert der Hotspot
        vermutlich den direkten Weg. Dann hilft nur: beide ins gleiche WLAN.</p>
      <div class="knopfsaeule">
        <button class="btn btn--quiet" id="abbruch">Abbrechen</button></div>
    </div></div>`;
    app.querySelector('#abbruch').onclick = kopplungAbbrechen;
    return;
  }

  if (k.schritt === 'zeigen') {
    app.innerHTML = `
      <div class="screen"><div class="scrollbar"><div class="wrap">
        <h2 class="h2">${k.gastgeber ? 'Zeig diesen Code' : 'Jetzt du zurück'}</h2>
        <p class="lead">${k.gastgeber
          ? 'Die andere Person scannt ihn mit „QR scannen“.'
          : 'Halt den Code dem ersten Handy hin — es scannt ihn.'}</p>
        <div class="qrfeld"><canvas id="qr" width="720" height="720"></canvas></div>
        <details class="codeklappe">
          <summary>Kamera streikt? Code als Text</summary>
          <textarea class="codefeld" id="raus" readonly>${esc(k.code || '')}</textarea>
          <button class="btn btn--ghost" id="kopieren">Kopieren</button>
        </details>
        <div class="knopfsaeule">
          <button class="btn btn--primary" id="weiterKoppeln">${k.gastgeber
            ? 'Weiter — jetzt den anderen Code scannen' : 'Fertig, warte auf Verbindung'}</button>
          <button class="btn btn--quiet" id="abbruch">Abbrechen</button>
        </div>
      </div></div></div>`;
    try {
      qrZeichnen(app.querySelector('#qr'), k.code, { hell: '#f3f2ee', dunkel: '#10161f' });
    } catch {
      app.querySelector('.qrfeld').textContent = 'Code zu lang für einen QR — nimm den Textcode.';
    }
    app.querySelector('#kopieren').onclick = async (e) => {
      try { await navigator.clipboard.writeText(k.code); e.currentTarget.textContent = 'Kopiert'; }
      catch { app.querySelector('#raus').select(); }
    };
    app.querySelector('#weiterKoppeln').onclick = () => {
      ui.kopplung.schritt = k.gastgeber ? 'scannen' : 'warten';
      ui.kopplung.scannerVersucht = false;
      render();
    };
    app.querySelector('#abbruch').onclick = kopplungAbbrechen;
    return;
  }

  if (k.schritt === 'scannen') {
    app.innerHTML = `
      <div class="screen"><div class="scrollbar"><div class="wrap">
        <h2 class="h2">Code scannen</h2>
        <p class="lead">Halte die Kamera auf den Code des anderen Handys.</p>
        <div class="scanfenster"><video id="kamera" muted playsinline></video></div>
        ${k.fehler ? `<p class="lead"><span class="warnton">${esc(k.fehler)}</span></p>` : ''}
        <details class="codeklappe" ${scannerMoeglich() ? '' : 'open'}>
          <summary>Kamera streikt? Code eintippen oder einfügen</summary>
          <textarea class="codefeld" id="rein" placeholder="QX1O|…"></textarea>
          <button class="btn btn--ghost" id="uebernehmen">Code übernehmen</button>
        </details>
        <div class="knopfsaeule">
          <button class="btn btn--quiet" id="abbruch">Abbrechen</button></div>
      </div></div></div>`;
    app.querySelector('#uebernehmen').onclick = () => {
      const code = app.querySelector('#rein').value.trim();
      if (code) fremdenCodeAnnehmen(code);
    };
    app.querySelector('#abbruch').onclick = kopplungAbbrechen;
    // Nur einmal versuchen: ein fehlgeschlagener Start rendert neu und würde
    // sich sonst selbst wieder aufrufen.
    if (!k.scannerVersucht) {
      k.scannerVersucht = true;
      scannerStarten(
        app.querySelector('#kamera'),
        (code) => { k.scannerStoppen = null; fremdenCodeAnnehmen(code); },
        (fehler) => { k.fehler = fehler.message; render(); },
      ).then((stoppen) => { if (ui.kopplung === k) k.scannerStoppen = stoppen; else stoppen(); });
    }
    return;
  }

  if (k.schritt === 'code') {
    app.innerHTML = `
      <div class="screen"><div class="wrap">
        <h2 class="h2">Code eingeben</h2>
        <p class="lead">Auf dem anderen Handy steht ein fünfstelliger Code.</p>
        <input class="field field--code" id="raumcode" maxlength="5" autocapitalize="characters"
          autocomplete="off" spellcheck="false" placeholder="ABCDE" value="${esc(k.code || '')}">
        ${k.fehler ? `<p class="lead" style="color:#e2664f">${esc(k.fehler)}</p>` : ''}
        <button class="btn btn--primary" id="beitreten" style="margin-top:14px">Mitspielen</button>
        <button class="btn btn--quiet" id="abbruch" style="margin-top:10px">Abbrechen</button>
      </div></div>`;
    const feld = app.querySelector('#raumcode');
    feld.focus();
    app.querySelector('#beitreten').onclick = () => {
      const wert = feld.value.trim().toUpperCase();
      if (wert.length < 4) { k.fehler = 'Der Code hat fünf Zeichen.'; render(); return; }
      netzStarten(false, wert);
    };
    app.querySelector('#abbruch').onclick = kopplungAbbrechen;
    return;
  }

  app.innerHTML = `
    <div class="screen"><div class="wrap">
      <h2 class="h2">${k.gastgeber ? 'Dein Raum steht' : 'Verbinde …'}</h2>
      ${k.gastgeber
        ? `<p class="lead">Gib diesen Code an das andere Handy — dort auf dieser Seite
             <b>„Mit Code beitreten“</b> wählen.</p>
           <div class="raumcode">${esc(k.code || '·····')}</div>
           <p class="lead">Ihr müsst <b>nicht</b> im selben WLAN sein.</p>`
        : `<p class="lead">${esc(k.hinweis || 'Der Raum wird gesucht …')}</p>`}
      ${k.fehler ? `<p class="lead" style="color:#e2664f">${esc(k.fehler)}</p>` : ''}
      <button class="btn btn--quiet" id="abbruch" style="margin-top:14px">Abbrechen</button>
    </div></div>`;
  app.querySelector('#abbruch').onclick = kopplungAbbrechen;
}

function renderHandover(need) {
  const step = currentStep(game);
  let task;
  if (game.phase === 'roll') task = 'Du bist am Zug und würfelst alle Würfel.';
  else if (step.kind === 'white') task = `Weiße Summe ${whiteSum(game)} — du darfst in einer Reihe ankreuzen.`;
  else task = 'Weiß + Farbe kombinieren.';

  const first = ui.holder === null;

  const layer = document.createElement('div');
  layer.className = 'overlay handover';
  layer.innerHTML = `
    <div class="arrow" aria-hidden="true">📱</div>
    <div class="lbl">${first ? 'Es beginnt' : 'Handy weitergeben an'}</div>
    <div class="name">${esc(game.players[need].name)}</div>
    <p class="task">${esc(task)}</p>
    <button class="btn btn--primary" id="btnReady">Ich hab's — weiter</button>`;
  app.appendChild(layer);
  layer.querySelector('#btnReady').onclick = () => {
    ui.holder = need;
    ui.viewPlayer = need;
    ui.pick = null;
    ui.fresh = null;
    sfx.tap();
    render();
  };
}

/* -------------------------------------------------------------- Endstand */

function renderOver() {
  const table = standings(game);
  const best = table[0].total;
  const winners = table.filter((r) => r.total === best);

  app.innerHTML = `
    <div class="screen">
      <div class="scroll">
        <div class="panel">
          <div class="winner">
            <div class="lbl">${winners.length > 1 ? 'Unentschieden' : 'Gewonnen hat'}</div>
            <div class="name">${winners.map((w) => esc(w.name)).join(' & ')}</div>
            <div class="pts num">${best} Punkte</div>
          </div>

          <table class="scoretable">
            <thead><tr>
              <th>Spieler</th>
              ${COLORS.map((c) => `<th class="c-${c}">${COLOR_LABEL[c].slice(0, 2)}</th>`).join('')}
              <th>Fehl</th><th>Σ</th>
            </tr></thead>
            <tbody>
              ${table.map((r) => `<tr class="${r.total === best ? 'win' : ''}">
                <td>${esc(r.name)}</td>
                ${COLORS.map((c) => `<td class="c-${c}">${r.rows[c]}</td>`).join('')}
                <td>${r.penalties}</td>
                <td class="tot">${r.total}</td>
              </tr>`).join('')}
            </tbody>
          </table>

          <p class="foot">Spielende: ${esc(endReason(game) || '')}</p>

          <div style="margin-top:22px;display:flex;flex-direction:column;gap:10px">
            <button class="btn btn--primary" id="again">Nochmal spielen</button>
            <button class="btn btn--ghost" id="home">Zum Start</button>
          </div>
        </div>
      </div>
    </div>`;

  app.querySelector('#again').onclick = () => startGame(game.players.map((p) => p.name));
  app.querySelector('#home').onclick = () => { game = null; ui.screen = 'start'; save(); render(); };
}

/* --------------------------------------------------------------- Overlays */

const SCORE_ROW = SCORE_TABLE.slice(1).map((p, i) => `<td>${p}</td>`).join('');

function renderRules() {
  const layer = document.createElement('div');
  layer.className = 'overlay';
  layer.innerHTML = `
    <div class="scroll">
      <div class="panel prose">
        <h2>Qwixx — so geht's</h2>
        <p>Kreuze in den vier Farbreihen möglichst viele Zahlen an. Wer am Ende die meisten
           Punkte hat, gewinnt.</p>

        <h3>Das Blatt</h3>
        <ul>
          <li><strong>Rot</strong> und <strong>Gelb</strong> laufen von 2 nach 12,
              <strong>Grün</strong> und <strong>Blau</strong> von 12 nach 2.</li>
          <li>Angekreuzt wird immer <strong>nur von links nach rechts</strong>. Übersprungene
              Zahlen sind für dich für den Rest des Spiels weg.</li>
        </ul>

        <h3>Ein Zug</h3>
        <ul>
          <li>Der aktive Spieler wirft <strong>alle</strong> Würfel.</li>
          <li><strong>Summe der beiden weißen Würfel:</strong> <em>jeder</em> darf sie in einer
              beliebigen Reihe ankreuzen — muss aber nicht.</li>
          <li><strong>Weiß + Farbe:</strong> zusätzlich darf <em>nur der aktive Spieler</em> einen
              weißen mit einem Farbwürfel addieren und das Ergebnis in genau dieser Farbreihe
              ankreuzen.</li>
          <li>Beides ist erlaubt, eins davon, oder keins.</li>
        </ul>

        <h3>Fehlwurf</h3>
        <p>Macht der aktive Spieler in seinem Zug <strong>kein einziges Kreuz</strong>, kostet
           ihn das einen Fehlwurf: <strong>−5 Punkte</strong>. Mitspieler trifft das nie.</p>

        <h3>Reihe sperren</h3>
        <ul>
          <li>Die letzte Zahl einer Reihe (12 bzw. 2) darfst du nur ankreuzen, wenn du in dieser
              Reihe schon <strong>mindestens ${LOCK_MIN_CROSSES} Kreuze</strong> hast.</li>
          <li>Wer sie ankreuzt, bekommt zusätzlich das <strong>Schloss</strong> — das zählt wie ein
              weiteres Kreuz — und <strong>sperrt die Reihe für alle</strong>. Der Farbwürfel
              fliegt raus.</li>
        </ul>

        <h3>Spielende</h3>
        <p>Sobald <strong>zwei Reihen gesperrt</strong> sind oder jemand
           <strong>${MAX_PENALTIES} Fehlwürfe</strong> hat, endet das Spiel nach dem laufenden Zug.</p>

        <h3>Punkte je Reihe</h3>
        <div style="overflow-x:auto">
          <table class="scoretable">
            <thead><tr><th>Kreuze</th>${SCORE_TABLE.slice(1).map((_, i) => `<th>${i + 1}</th>`).join('')}</tr></thead>
            <tbody><tr><td>Punkte</td>${SCORE_ROW}</tr></tbody>
          </table>
        </div>
        <p style="margin-top:8px">Das Schloss zählt als Kreuz mit. Fehlwürfe werden abgezogen.</p>

        <h3>An einem Handy</h3>
        <p>Das Handy wandert reihum. In der App entscheidet erst der aktive Spieler (weiße Summe,
           dann Weiß + Farbe), danach die Mitspieler — am Tisch passiert das gleichzeitig.
           Sperrt jemand eine Reihe, dürfen die anderen im selben Wurf dieselbe Zahl noch
           ankreuzen, genau wie im Original.</p>

        <div style="margin-top:22px"><button class="btn btn--primary" id="close">Verstanden</button></div>
      </div>
    </div>`;
  app.appendChild(layer);
  layer.querySelector('#close').onclick = () => { ui.overlay = null; render(); };
}

function renderMenu() {
  const layer = document.createElement('div');
  layer.className = 'overlay';
  layer.innerHTML = `
    <div class="scroll"><div class="panel">
      <h2>Menü</h2>
      <div style="margin-top:20px;display:flex;flex-direction:column;gap:10px">
        <button class="btn btn--ghost" id="sound">Ton: ${prefs.sound ? 'an' : 'aus'}</button>
        <button class="btn btn--ghost" id="rules">Spielregeln</button>
        <button class="btn btn--ghost" id="save">Spiel als Datei sichern</button>
        <button class="btn btn--ghost" id="share">Spiel weitergeben</button>
        <button class="btn btn--danger" id="abort">Spiel abbrechen</button>
        <button class="btn btn--primary" id="close">Weiterspielen</button>
      </div>
      <p class="foot" style="margin-top:24px">Der Spielstand wird auf diesem Gerät gespeichert —
         die App darf zwischendurch geschlossen werden.</p>
    </div></div>`;
  app.appendChild(layer);
  layer.querySelector('#sound').onclick = () => { prefs.sound = !prefs.sound; save(); render(); };
  layer.querySelector('#share').onclick = async (e) => {
    const knopf = e.currentTarget;
    knopf.disabled = true;
    knopf.textContent = 'Teilen-Menü …';
    const erg = await spielTeilen('qwixx-css', 'qwixx-js', 'Qwixx.html', 'Qwixx');
    knopf.textContent = TEILEN_TEXT[erg];
    knopf.disabled = erg === 'ok';
  };
  layer.querySelector('#save').onclick = async (e) => {
    const knopf = e.currentTarget;
    knopf.disabled = true;
    knopf.textContent = 'Wird gespeichert …';
    const stand = await seiteAlsDateiSichern('qwixx-css', 'qwixx-js', 'Qwixx.html', 'Qwixx');
    knopf.textContent = SICHER_TEXT[stand].replace('%NAME%', 'Qwixx.html');
    knopf.disabled = stand === 'ok' || stand === 'txt';
  };
  layer.querySelector('#rules').onclick = () => { ui.overlay = 'rules'; render(); };
  layer.querySelector('#close').onclick = () => { ui.overlay = null; render(); };
  layer.querySelector('#abort').onclick = () => {
    game = null; ui.screen = 'start'; ui.overlay = null;
    try { localStorage.removeItem(SAVE_KEY); } catch { /* egal */ }
    render();
  };
}

/* ----------------------------------------------------------------- Render */

function render() {
  if (ui.kopplung) { renderKopplung(); return; }
  if (ui.modus === 'online' && !game) {
    app.innerHTML = `<div class="screen"><div class="wrap">
      <h2 class="h2">Verbunden</h2>
      <p class="lead">Warte auf das Blatt vom anderen Handy …</p></div></div>`;
    return;
  }
  if (ui.screen === 'start' || !game) renderStart();
  else if (ui.screen === 'over' || game.phase === 'over') renderOver();
  else renderGame();

  if (ui.overlay === 'rules') renderRules();
  else if (ui.overlay === 'menu') renderMenu();
  else if (ui.screen === 'game' && game) {
    const need = requiredPlayer();
    if (need === null) return;
    if (ui.modus === 'online') { if (need !== ui.meinIndex) renderWarten(need); }
    else if (need !== ui.holder) renderHandover(need);
  }
}

loadPrefs();
render();
