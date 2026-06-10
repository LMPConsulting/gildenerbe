import { createWebStorage } from './core/storage.js';
import { loadGame, saveGame } from './core/save.js';
import { createInitialState } from './core/state.js';
import { createLoop } from './core/loop.js';
import { createEventBus } from './core/eventBus.js';

const storage = createWebStorage();
const bus = createEventBus();

// Load existing save or start a fresh account.
let state = loadGame(storage);
const isNew = !state;
if (isNew) {
  state = createInitialState();
  state.createdAt = Date.now();
}

// One tick = one fixed step; count it so we can SEE the loop running & persisting.
function tick() {
  state.stats.playTicks += 1;
}

const loop = createLoop({ tick, dt: 1000 / 30 });

function save() {
  state.lastSaved = Date.now();
  saveGame(storage, state);
  bus.emit('saved', state.lastSaved);
}

// --- minimal render ---
const app = document.getElementById('app');
function render() {
  app.innerHTML = `
    <div class="panel">
      <h1>GILDENERBE</h1>
      <div class="stat">Status: <b>${isNew ? 'Neues Spiel' : 'Fortgesetzt'}</b></div>
      <div class="stat">Ticks: <b id="ticks">${state.stats.playTicks}</b></div>
      <div class="stat">Erbe: <b>${state.meta.erbe}</b></div>
      <div class="stat">Klassen: <b>${state.meta.unlockedClasses.join(', ')}</b></div>
    </div>
    <button id="reset">Spielstand zurücksetzen</button>
  `;
  document.getElementById('reset').onclick = () => {
    storage.removeItem('gildenerbe.save');
    location.reload();
  };
}
render();

// rAF drives the loop; update only the ticks number each frame (cheap).
let last = performance.now();
const ticksEl = () => document.getElementById('ticks');
function frame(now) {
  loop.advance(now - last);
  last = now;
  const el = ticksEl();
  if (el) el.textContent = state.stats.playTicks;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// autosave: interval + on tab hide (mobile background)
setInterval(save, 5000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') save();
});

// expose for manual debugging in the console
window.__GE = { get state() { return state; }, save };
