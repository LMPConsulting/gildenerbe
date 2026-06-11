// The visual base: a canvas scene of the guild grounds — wall ring with gate,
// the five buildings on fixed plots (drawn at their current level, level 0 =
// empty plot), the hero standing in the middle, ambient torches and trees.
// DOM is only touched inside mountBaseScreen.

import { drawSprite } from './sprites.js';
import { drawBuilding, drawGround, drawProp } from './baseSprites.js';
import { buildingLevel } from '../systems/gildenhalle.js';
import { BUILDINGS } from '../data/buildings.js';

const W = 360;
const H = 300;
const WALL_S = 2;                 // wall segment cell size (segment = 32px)
const SEG = 16 * WALL_S;

// Fixed plot layout: Gildenhalle center-top, guild buildings around it.
// Each plot is a 16s box whose bottom edge is the building's ground line.
const PLOTS = [
  { id: 'gildenhalle',    x: 148, y: 24,  s: 4 },
  { id: 'trainingshalle', x: 34,  y: 44,  s: 3 },
  { id: 'schatzkammer',   x: 278, y: 44,  s: 3 },
  { id: 'waffenkammer',   x: 44,  y: 150, s: 3 },
  { id: 'heldengruft',    x: 268, y: 150, s: 3 },
];
const TOR = { x: 156, y: 250, s: 3 };                    // gate, bottom center
const TOR_HIT = { x: 148, y: 246, w: 64, h: 52 };
const HERO = { x: 156, y: 128, s: 3 };                   // standing mid-yard

const STYLE = `
.base-wrap { position: relative; width: 360px; max-width: 100%; margin: 0 auto;
  display: flex; flex-direction: column; gap: 8px; }
.base-scene { position: relative; }
.base-canvas { display: block; width: 100%; image-rendering: pixelated;
  border: 2px solid #c8a04a; border-radius: 6px; background: #1a1712;
  touch-action: manipulation; }
.base-hud-top { position: absolute; top: 6px; left: 0; right: 0; text-align: center;
  font-size: 12px; color: #e8dcc0; letter-spacing: .5px; pointer-events: none;
  text-shadow: 0 1px 2px #000, 0 0 4px #000; }
.base-hud-top b { color: #ffd24a; }
.base-attack { position: absolute; top: 24px; left: 50%; transform: translateX(-50%);
  background: rgba(110, 29, 22, .92); border: 1px solid #e06b5e; color: #ffd9d2;
  font-size: 12px; font-weight: bold; padding: 4px 12px; border-radius: 6px;
  white-space: nowrap; pointer-events: none; animation: base-pulse 1s ease-in-out infinite; }
@keyframes base-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }
.base-hud-btm { display: flex; gap: 8px; justify-content: center; }
.base-btn-hero { flex: 1; max-width: 170px; font-size: 14px; padding: 10px; }
.base-btn-missions { font-size: 13px; }
.base-btn-codex { min-width: 40px; font-size: 14px; }
`;

// mountBaseScreen(root, account, { onOpenBuilding, onNewHero, onMissions, onCodex })
// Returns { unmount, refresh } — call refresh() after purchases/state changes.
export function mountBaseScreen(root, account, callbacks = {}) {
  const { onOpenBuilding, onNewHero, onMissions, onCodex } = callbacks;

  if (!document.querySelector('style[data-base]')) {
    const st = document.createElement('style');
    st.setAttribute('data-base', '');
    st.textContent = STYLE;
    document.head.appendChild(st);
  }

  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'base-wrap';
  const scene = document.createElement('div');
  scene.className = 'base-scene';
  const canvas = document.createElement('canvas');
  canvas.className = 'base-canvas';
  const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 3);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');

  const hudTop = document.createElement('div');
  hudTop.className = 'base-hud-top';
  const attack = document.createElement('div');
  attack.className = 'base-attack';
  attack.textContent = '⚔ Überfall steht bevor!';
  attack.style.display = 'none';

  const hudBtm = document.createElement('div');
  hudBtm.className = 'base-hud-btm';
  hudBtm.innerHTML = `
    <button class="base-btn-hero">Neuer Held</button>
    <button class="base-btn-missions">Missionen</button>
    <button class="base-btn-codex" title="Codex">?</button>`;

  scene.appendChild(canvas);
  scene.appendChild(hudTop);
  scene.appendChild(attack);
  wrap.appendChild(scene);
  wrap.appendChild(hudBtm);
  root.appendChild(wrap);

  hudBtm.querySelector('.base-btn-hero').onclick = () => onNewHero && onNewHero();
  hudBtm.querySelector('.base-btn-missions').onclick = () => onMissions && onMissions();
  hudBtm.querySelector('.base-btn-codex').onclick = () => onCodex && onCodex();

  const wallLevel = () => (account.base && account.base.wallLevel) || 0;
  const level = (id) => buildingLevel(account.meta || {}, id);

  // Static ground layer (grass + dirt path), rendered once and blitted.
  const ground = document.createElement('canvas');
  ground.width = W * dpr;
  ground.height = H * dpr;
  (function paintGround() {
    const g = ground.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGround(g, W, H, 2);
    g.fillStyle = '#5d4426';                            // path: gate -> hall
    g.fillRect(166, 96, 28, 196);
    g.fillStyle = '#49351d';
    g.fillRect(166, 96, 2, 196);
    g.fillRect(192, 96, 2, 196);
    g.fillRect(162, 150, 4, 12);                        // worn edges
    g.fillRect(194, 210, 4, 12);
    g.fillStyle = '#6b4f2c';                            // flat stones
    g.fillRect(174, 130, 4, 2);
    g.fillRect(182, 190, 4, 2);
    g.fillRect(176, 250, 4, 2);
  })();

  function drawLabel(text, cx, cy) {
    ctx.font = 'bold 8px ui-monospace, "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10, 8, 5, .7)';
    ctx.fillText(text, cx + 1, cy + 1);
    ctx.fillStyle = '#e8dcc0';
    ctx.fillText(text, cx, cy);
  }

  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(ground, 0, 0, W, H);
    const wl = wallLevel();

    // wall ring: top band, then rotated side bands
    for (let sx = 0; sx < W; sx += SEG) drawBuilding(ctx, 'mauer', wl, sx, -2, WALL_S, t);
    for (let sy = 16; sy < H; sy += SEG) {
      ctx.save();
      ctx.translate(SEG, sy);
      ctx.rotate(Math.PI / 2);
      drawBuilding(ctx, 'mauer', wl, 0, 0, WALL_S, t);
      ctx.restore();
      ctx.save();
      ctx.translate(W - SEG, sy + SEG);
      ctx.rotate(-Math.PI / 2);
      drawBuilding(ctx, 'mauer', wl, 0, 0, WALL_S, t);
      ctx.restore();
    }

    // buildings on their plots + name tags
    for (const p of PLOTS) {
      const lvl = level(p.id);
      drawBuilding(ctx, p.id, lvl, p.x, p.y, p.s, t);
      const b = BUILDINGS[p.id];
      const name = b ? b.name : 'Gildenhalle';
      drawLabel(lvl > 0 ? `${name} ${lvl}` : name, p.x + 8 * p.s, p.y + 16 * p.s + 9);
    }

    // ambient props
    drawProp(ctx, 'baum', 92, 20, 2, t);
    drawProp(ctx, 'baum', 236, 112, 2, t);
    drawProp(ctx, 'brunnen', 112, 150, 2, t);
    drawProp(ctx, 'fackel', 126, 56, 2, t);            // hall entrance torches
    drawProp(ctx, 'fackel', 202, 56, 2, t);

    // the current hero, standing in the yard
    drawSprite(ctx, 'hero', HERO.x, HERO.y, HERO.s);

    // front wall + gate drawn last (in front), with gate torches
    for (let sx = 0; sx < W; sx += SEG) drawBuilding(ctx, 'mauer', wl, sx, 266, WALL_S, t);
    drawBuilding(ctx, 'tor', wl, TOR.x, TOR.y, TOR.s, t);
    drawProp(ctx, 'fackel', 118, 252, 2, t);
    drawProp(ctx, 'fackel', 210, 252, 2, t);
  }

  function updateHud() {
    const erbe = (account.meta && account.meta.erbe) || 0;
    const chronik = (account.chronik && account.chronik.punkte) || 0;
    const runs = (account.stats && account.stats.totalRuns) || 0;
    hudTop.innerHTML = `Erbe: <b>${erbe}</b> · Chronik: ${chronik} · Läufe: ${runs}`;
    attack.style.display = account.base && account.base.underAttack ? '' : 'none';
  }

  function onTap(e) {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const lx = (e.clientX - r.left) * (W / r.width);
    const ly = (e.clientY - r.top) * (H / r.height);
    for (const p of PLOTS) {
      const size = 16 * p.s;
      if (lx >= p.x - 3 && lx <= p.x + size + 3 && ly >= p.y - 3 && ly <= p.y + size + 3) {
        if (onOpenBuilding) onOpenBuilding(p.id);
        return;
      }
    }
    if (lx >= TOR_HIT.x && lx <= TOR_HIT.x + TOR_HIT.w &&
        ly >= TOR_HIT.y && ly <= TOR_HIT.y + TOR_HIT.h) {
      if (onNewHero) onNewHero();                       // out through the gate
    }
  }
  canvas.addEventListener('click', onTap);

  // gentle ambient animation: ~10 fps is plenty for flag wave + torch flicker
  let raf = 0;
  let last = -1000;
  function tick(ts) {
    if (ts - last >= 95) { last = ts; draw(ts); }
    raf = requestAnimationFrame(tick);
  }

  updateHud();
  draw(0);
  raf = requestAnimationFrame(tick);

  return {
    // Re-read the account and repaint (host calls this after upgrades).
    refresh() {
      updateHud();
      draw((typeof performance !== 'undefined' && performance.now()) || 0);
    },
    unmount() {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('click', onTap);
      wrap.remove();
    },
  };
}
