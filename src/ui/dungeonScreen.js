import { drawSprite } from './sprites.js';
import { ABILITIES } from '../data/abilities.js';
import { TILE } from '../systems/dungeonSim.js';

// Top-down dungeon renderer + touch controls. Owns NO game logic: it draws
// dungeon.state, forwards joystick/ability/interact inputs, and reacts to
// sim events. Returns unmount().
const TS = 26;          // tile size in px
const SPR_SCALE = 1.5;  // 16-cell sprites -> 24px, 1px padding inside a tile

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || document.querySelector('style[data-dgn]')) return;
  stylesInjected = true;
  const st = document.createElement('style');
  st.dataset.dgn = '1';
  st.textContent = `
    .dgn-wrap { display:flex; flex-direction:column; align-items:center; gap:8px;
      width:100%; max-width:420px; touch-action:none; }
    .dgn-canvas { image-rendering:pixelated; border:2px solid #c8a04a; border-radius:6px;
      background:#1a140f; max-width:100%; }
    .dgn-hud { width:100%; display:flex; flex-direction:column; gap:4px; }
    .dgn-controls { display:flex; width:100%; align-items:flex-end; justify-content:space-between; gap:10px; }
    .dgn-stick { position:relative; width:104px; height:104px; border-radius:50%;
      border:2px solid #5a4a2a; background:rgba(36,31,23,.6); flex:none; touch-action:none; }
    .dgn-knob { position:absolute; left:50%; top:50%; width:42px; height:42px; border-radius:50%;
      background:#c8a04a; transform:translate(-50%,-50%); opacity:.85; }
    .dgn-right { display:flex; flex-direction:column; gap:6px; align-items:flex-end; flex:1; }
    .dgn-interact { background:#7bd88f; font-weight:bold; min-width:120px; }
    .dgn-interact:disabled { opacity:.25; }
  `;
  document.head.appendChild(st);
}

export function mountDungeonScreen(root, dungeon, { onEnd, onEvent } = {}) {
  injectStyles();
  const s = dungeon.state;
  const W = s.cols * TS, H = s.rows * TS;
  let raf = 0, last = performance.now(), ended = false;
  const floats = [];
  let telegraph = null; // { tiles, castMs, t }
  const unsubs = [];

  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'dgn-wrap';
  wrap.innerHTML = `
    <div class="dgn-hud">
      <div class="bar hp"><i></i><label>HP</label></div>
      <div class="bar rage"><i></i><label>Wut</label></div>
    </div>
    <canvas class="dgn-canvas" width="${W}" height="${H}"></canvas>
    <div class="dgn-controls">
      <div class="dgn-stick"><div class="dgn-knob"></div></div>
      <div class="dgn-right">
        <button class="dgn-interact" disabled>Interagieren</button>
        <div class="ability-row"></div>
      </div>
    </div>
  `;
  root.appendChild(wrap);

  const canvas = wrap.querySelector('.dgn-canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const hpBar = wrap.querySelector('.bar.hp i');
  const rageBar = wrap.querySelector('.bar.rage i');
  const interactBtn = wrap.querySelector('.dgn-interact');
  const stick = wrap.querySelector('.dgn-stick');
  const knob = wrap.querySelector('.dgn-knob');

  // --- unit position lookup for floating numbers ---
  function unitPos(id) {
    if (id === 'hero') return { x: s.hero.x, y: s.hero.y };
    const e = s.enemies.find((en) => (en.unit.uid ?? en.unit.id) === id);
    return e ? { x: e.x, y: e.y } : null;
  }

  unsubs.push(dungeon.on((e) => {
    if (e.type === 'damage') {
      const p = unitPos(e.targetId);
      if (p) floats.push({ x: p.x * TS + TS / 2, y: p.y * TS, text: String(e.amount), crit: !!e.crit, life: e.crit ? 800 : 600, max: 800 });
    } else if (e.type === 'loot') {
      floats.push({ x: s.hero.x * TS + TS / 2, y: s.hero.y * TS, text: '+Beute!', crit: true, life: 900, max: 900 });
    } else if (e.type === 'telegraphMark') {
      telegraph = { tiles: e.tiles, castMs: e.castMs, t: 0 };
    } else if (e.type === 'telegraphResolve') {
      telegraph = null;
    } else if (e.type === 'end') {
      finish(e.result);
    }
  }));

  // --- ability buttons (reuse global .ability styles) ---
  const abilityRow = wrap.querySelector('.ability-row');
  const buttons = s.hero.unit.abilities.map((id) => {
    const b = document.createElement('button');
    b.className = 'ability';
    b.dataset.id = id;
    b.onclick = () => dungeon.queueAbility(id);
    abilityRow.appendChild(b);
    return b;
  });

  interactBtn.onclick = () => {
    const r = dungeon.interact();
    if (r && r.type === 'event') onEvent && onEvent();
  };

  // --- virtual joystick (pointer events) ---
  let stickId = null, originX = 0, originY = 0;
  const DEAD = 12;
  function setKnob(dx, dy) {
    const m = Math.min(34, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    knob.style.transform = `translate(calc(-50% + ${Math.cos(a) * m}px), calc(-50% + ${Math.sin(a) * m}px))`;
  }
  function applyStick(dx, dy) {
    const mx = Math.abs(dx) > DEAD ? Math.sign(dx) : 0;
    const my = Math.abs(dy) > DEAD ? Math.sign(dy) : 0;
    dungeon.setMove(mx, my);
  }
  stick.addEventListener('pointerdown', (ev) => {
    stickId = ev.pointerId;
    stick.setPointerCapture(stickId);
    originX = ev.clientX; originY = ev.clientY;
    ev.preventDefault();
  });
  stick.addEventListener('pointermove', (ev) => {
    if (ev.pointerId !== stickId) return;
    const dx = ev.clientX - originX, dy = ev.clientY - originY;
    setKnob(dx, dy);
    applyStick(dx, dy);
    ev.preventDefault();
  });
  const stickEnd = (ev) => {
    if (ev.pointerId !== stickId) return;
    stickId = null;
    knob.style.transform = 'translate(-50%,-50%)';
    dungeon.setMove(0, 0);
  };
  stick.addEventListener('pointerup', stickEnd);
  stick.addEventListener('pointercancel', stickEnd);

  // --- keyboard (desktop testing) ---
  const keys = new Set();
  const KEYMAP = { w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  function applyKeys() {
    let dx = 0, dy = 0;
    for (const k of keys) { const v = KEYMAP[k]; if (v) { dx += v[0]; dy += v[1]; } }
    dungeon.setMove(Math.sign(dx), Math.sign(dy));
  }
  const onKeyDown = (ev) => {
    if (KEYMAP[ev.key]) { keys.add(ev.key); applyKeys(); ev.preventDefault(); }
    else if (ev.key === 'e' || ev.key === 'Enter') interactBtn.click();
  };
  const onKeyUp = (ev) => { if (KEYMAP[ev.key]) { keys.delete(ev.key); applyKeys(); } };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // --- drawing ---
  function drawTile(x, y, t, time) {
    const px = x * TS, py = y * TS;
    if (t === TILE.WALL) {
      ctx.fillStyle = '#4a3b28';
      ctx.fillRect(px, py, TS, TS);
      ctx.fillStyle = '#5d4c33';
      ctx.fillRect(px, py, TS, 4);
      return;
    }
    // floor base (checker variation)
    ctx.fillStyle = (x + y) % 2 === 0 ? '#2a2218' : '#272015';
    ctx.fillRect(px, py, TS, TS);
    if (t === TILE.CHEST || t === TILE.CHEST_OPEN) {
      const open = t === TILE.CHEST_OPEN;
      ctx.fillStyle = open ? '#5d5343' : '#c8a04a';
      ctx.fillRect(px + 5, py + 8, TS - 10, TS - 14);
      ctx.fillStyle = open ? '#43301d' : '#8a6120';
      ctx.fillRect(px + 5, py + 8, TS - 10, 4);
      if (!open) { ctx.fillStyle = '#f2f4ef'; ctx.fillRect(px + TS / 2 - 1, py + 12, 2, 4); }
    } else if (t === TILE.EVENT) {
      const pulse = 0.6 + 0.4 * Math.sin(time / 300);
      ctx.fillStyle = `rgba(163,53,238,${pulse.toFixed(2)})`;
      ctx.beginPath();
      ctx.moveTo(px + TS / 2, py + 5);
      ctx.lineTo(px + TS - 5, py + TS / 2);
      ctx.lineTo(px + TS / 2, py + TS - 5);
      ctx.lineTo(px + 5, py + TS / 2);
      ctx.closePath();
      ctx.fill();
    } else if (t === TILE.EXIT) {
      ctx.fillStyle = '#1eba5a';
      ctx.fillRect(px + 4, py + 4, TS - 8, TS - 8);
      ctx.fillStyle = '#0f6e3a';
      for (let i = 0; i < 3; i++) ctx.fillRect(px + 6, py + 7 + i * 6, TS - 12, 3);
    } else if (t === TILE.DOOR) {
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(px + 3, py, TS - 6, TS);
    }
  }

  function render(dt, time) {
    ctx.clearRect(0, 0, W, H);
    for (let y = 0; y < s.rows; y++) {
      for (let x = 0; x < s.cols; x++) drawTile(x, y, s.tiles[y][x], time);
    }
    // telegraph zone (pulsing red)
    if (telegraph) {
      telegraph.t += dt;
      const a = 0.25 + 0.3 * Math.abs(Math.sin(time / 120)) + 0.25 * (telegraph.t / telegraph.castMs);
      ctx.fillStyle = `rgba(224,80,60,${Math.min(0.75, a).toFixed(2)})`;
      for (const t of telegraph.tiles) ctx.fillRect(t.x * TS, t.y * TS, TS, TS);
    }
    // units: shadow + sprite + hp bar
    const drawUnit = (gx, gy, key) => {
      const px = gx * TS + 1, py = gy * TS + 1;
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(px + 4, gy * TS + TS - 3, TS - 10, 2);
      drawSprite(ctx, key, px, py, SPR_SCALE);
    };
    for (const e of s.enemies) {
      if (!e.unit.alive) continue;
      drawUnit(e.x, e.y, e.unit.sprite);
      const frac = Math.max(0, e.unit.hp / e.unit.maxHp);
      ctx.fillStyle = '#000';
      ctx.fillRect(e.x * TS + 2, e.y * TS - 4, TS - 4, 3);
      ctx.fillStyle = e.unit.boss ? '#e06b5e' : '#c0392b';
      ctx.fillRect(e.x * TS + 2, e.y * TS - 4, (TS - 4) * frac, 3);
    }
    if (s.hero.unit.alive) {
      drawUnit(s.hero.x, s.hero.y, 'hero');
      if (s.hero.unit.blocking > 0) {
        ctx.strokeStyle = '#4ad6ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(s.hero.x * TS + 1, s.hero.y * TS + 1, TS - 2, TS - 2);
      }
    }
    // floating damage numbers
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life -= dt; f.y -= dt * 0.025;
      if (f.life <= 0) { floats.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, f.life / f.max);
      ctx.fillStyle = f.crit ? '#ffd24a' : '#ff7a6e';
      ctx.font = f.crit ? 'bold 13px monospace' : 'bold 11px monospace';
      ctx.fillText(f.text, f.x - 8, f.y);
      ctx.globalAlpha = 1;
    }
  }

  function updateHud() {
    const h = s.hero.unit;
    hpBar.style.width = (100 * Math.max(0, h.hp) / h.maxHp) + '%';
    rageBar.style.width = (100 * h.resource.value / h.resource.max) + '%';
    for (const b of buttons) {
      const ab = ABILITIES[b.dataset.id];
      const cd = h.cooldowns[b.dataset.id] || 0;
      b.disabled = cd > 0 || h.resource.value < ab.cost || !!s.result;
      b.textContent = ab.name + (cd > 0 ? ` ${Math.ceil(cd / 1000)}s` : '');
      b.classList.toggle('active-block', b.dataset.id === 'shield_block' && h.blocking > 0);
    }
    interactBtn.disabled = !dungeon.peekInteract();
  }

  function frame(now) {
    const dt = Math.min(100, now - last);
    last = now;
    if (!s.result) dungeon.step(dt);
    render(dt, now);
    updateHud();
    if (!ended) raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function finish(result) {
    if (ended) return;
    ended = true;
    unmount();
    onEnd && onEnd(result);
  }

  function unmount() {
    ended = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    unsubs.forEach((u) => u());
  }
  return unmount;
}
