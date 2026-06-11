import { drawSprite } from './sprites.js';
import { ABILITIES } from '../data/abilities.js';
import { TILE } from '../systems/dungeonSim.js';

// Top-down renderer + touch controls for the continuous dungeon. Camera follows
// the hero; sprites flip to face their movement/aim; projectiles, boss ground
// telegraphs and floating numbers are drawn from sim state/events. NO game logic.
const TS = 26;          // tile px
const VW = 14, VH = 9;  // visible tiles (camera window)

let injected = false;
function injectStyles() {
  if (injected || document.querySelector('style[data-dgn]')) return;
  injected = true;
  const st = document.createElement('style'); st.dataset.dgn = '1';
  st.textContent = `
    .dgn { display:flex; flex-direction:column; align-items:center; gap:6px; width:100%; touch-action:none; }
    .dgn-canvas { image-rendering:pixelated; border:2px solid #c8a04a; border-radius:6px; background:#15110b; width:min(100%,${VW * TS}px); }
    .dgn-bars { width:min(100%,${VW * TS}px); display:flex; flex-direction:column; gap:3px; }
    .dgn-ctl { display:flex; align-items:center; justify-content:space-between; gap:10px; width:min(100%,${VW * TS}px); }
    .dgn-stick { position:relative; width:108px; height:108px; border-radius:50%; flex:none;
      border:2px solid #5a4a2a; background:rgba(36,31,23,.55); touch-action:none; }
    .dgn-knob { position:absolute; left:50%; top:50%; width:44px; height:44px; border-radius:50%; background:#c8a04a; transform:translate(-50%,-50%); }
    .dgn-acts { display:flex; flex-wrap:wrap; gap:5px; justify-content:flex-end; flex:1; }
    .dgn-acts .ability { min-width:62px; }
    .dgn-int { background:#7bd88f; font-weight:bold; }
    .dgn-int:disabled { opacity:.25; }
    @media (orientation:landscape){
      .dgn{ flex-direction:row; flex-wrap:wrap; align-items:flex-start; justify-content:center; gap:10px; }
      .dgn-canvas{ width:auto; height:min(74vh,${VH * TS * 1.4}px); }
      .dgn-bars,.dgn-ctl{ width:auto; }
      .dgn-ctl{ flex-direction:column; align-items:stretch; }
    }
  `;
  document.head.appendChild(st);
}

export function mountDungeonScreen(root, dungeon, { onEnd, onEvent } = {}) {
  injectStyles();
  const s = dungeon.state;
  const W = VW * TS, H = VH * TS;
  let raf = 0, last = performance.now(), ended = false;
  const floats = [], marks = [], unsubs = [];

  root.innerHTML = '';
  const wrap = document.createElement('div'); wrap.className = 'dgn';
  wrap.innerHTML = `
    <canvas class="dgn-canvas" width="${W}" height="${H}"></canvas>
    <div class="dgn-side">
      <div class="dgn-bars">
        <div class="bar hp"><i></i><label>HP</label></div>
        <div class="bar res"><i></i><label>—</label></div>
      </div>
      <div class="dgn-ctl">
        <div class="dgn-stick"><div class="dgn-knob"></div></div>
        <div class="dgn-acts"></div>
        <button class="dgn-int" disabled>Aktion</button>
      </div>
    </div>`;
  root.appendChild(wrap);
  const canvas = wrap.querySelector('.dgn-canvas');
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const hpBar = wrap.querySelector('.bar.hp i');
  const resBar = wrap.querySelector('.bar.res i');
  const resLbl = wrap.querySelector('.bar.res label');
  const intBtn = wrap.querySelector('.dgn-int');
  const stick = wrap.querySelector('.dgn-stick');
  const knob = wrap.querySelector('.dgn-knob');
  const acts = wrap.querySelector('.dgn-acts');

  const RES_COLOR = { rage: '#b34a2a', energie: '#e0c04a', mana: '#3a7ad6' };
  resLbl.textContent = ({ rage: 'Wut', energie: 'Energie', mana: 'Mana' })[s.hero.unit.resource.type] || '—';
  resBar.style.background = RES_COLOR[s.hero.unit.resource.type] || '#888';

  const buttons = s.hero.unit.abilities.map((id) => {
    const b = document.createElement('button'); b.className = 'ability'; b.dataset.id = id;
    b.onclick = () => dungeon.queueAbility(id); acts.appendChild(b); return b;
  });
  intBtn.onclick = () => { const r = dungeon.interact(); if (r && r.type === 'event') onEvent && onEvent(); };

  unsubs.push(dungeon.on((e) => {
    if (e.type === 'damage') {
      const u = e.targetId === 'hero' ? s.hero : s.enemies.find((x) => (x.unit.uid ?? x.unit.id) === e.targetId);
      if (u) floats.push({ x: u.x, y: u.y, text: String(e.amount), crit: !!e.crit, hero: e.targetId === 'hero', life: 650, max: 650 });
    } else if (e.type === 'loot') {
      floats.push({ x: s.hero.x, y: s.hero.y, text: '+Beute!', crit: true, life: 900, max: 900 });
    } else if (e.type === 'telegraphMark') {
      marks.push({ x: e.x, y: e.y, radius: e.radius, castMs: e.castMs, t: 0, charge: !!e.charge });
    } else if (e.type === 'end') finish(e.result);
  }));

  // ---- camera ----
  let camX = 0, camY = 0;
  function updateCam() {
    camX = Math.max(0, Math.min(s.cols * TS - W, s.hero.x * TS - W / 2));
    camY = Math.max(0, Math.min(s.rows * TS - H, s.hero.y * TS - H / 2));
  }
  const sx = (wx) => wx * TS - camX;
  const sy = (wy) => wy * TS - camY;

  function drawTile(x, y, t, time) {
    const px = sx(x), py = sy(y);
    if (px < -TS || py < -TS || px > W || py > H) return;
    if (t === TILE.WALL) { ctx.fillStyle = '#473826'; ctx.fillRect(px, py, TS, TS); ctx.fillStyle = '#5b4a32'; ctx.fillRect(px, py, TS, 4); return; }
    if (t === TILE.PILLAR) { ctx.fillStyle = '#2a2218'; ctx.fillRect(px, py, TS, TS); ctx.fillStyle = '#6a5638'; ctx.fillRect(px + 5, py + 3, TS - 10, TS - 6); ctx.fillStyle = '#3a2e1d'; ctx.fillRect(px + 5, py + TS - 7, TS - 10, 4); return; }
    ctx.fillStyle = (x + y) % 2 === 0 ? '#2a2218' : '#262014'; ctx.fillRect(px, py, TS, TS);
    if (t === TILE.CHEST || t === TILE.CHEST_OPEN) {
      const open = t === TILE.CHEST_OPEN; ctx.fillStyle = open ? '#5d5343' : '#c8a04a';
      ctx.fillRect(px + 5, py + 8, TS - 10, TS - 14); ctx.fillStyle = open ? '#43301d' : '#8a6120'; ctx.fillRect(px + 5, py + 8, TS - 10, 4);
    } else if (t === TILE.EVENT) {
      const p = 0.6 + 0.4 * Math.sin(time / 300); ctx.fillStyle = `rgba(163,53,238,${p.toFixed(2)})`;
      ctx.beginPath(); ctx.moveTo(px + TS / 2, py + 5); ctx.lineTo(px + TS - 5, py + TS / 2); ctx.lineTo(px + TS / 2, py + TS - 5); ctx.lineTo(px + 5, py + TS / 2); ctx.closePath(); ctx.fill();
    } else if (t === TILE.EXIT) {
      ctx.fillStyle = '#1eba5a'; ctx.fillRect(px + 4, py + 4, TS - 8, TS - 8); ctx.fillStyle = '#0f6e3a';
      for (let i = 0; i < 3; i++) ctx.fillRect(px + 6, py + 7 + i * 6, TS - 12, 3);
    }
  }

  function drawUnit(u, key, scale, facing) {
    const px = sx(u.x), py = sy(u.y), sprPx = 16 * scale;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(px, py + sprPx * 0.42, sprPx * 0.32, sprPx * 0.14, 0, 0, 7); ctx.fill();
    const left = Math.cos(facing) < -0.15;
    ctx.save(); ctx.translate(px, py);
    if (left) ctx.scale(-1, 1);
    drawSprite(ctx, key, -sprPx / 2, -sprPx * 0.62, scale);
    ctx.restore();
  }

  function render(dt, time) {
    updateCam();
    ctx.fillStyle = '#15110b'; ctx.fillRect(0, 0, W, H);
    const x0 = Math.floor(camX / TS), y0 = Math.floor(camY / TS);
    for (let y = y0; y <= y0 + VH + 1; y++) for (let x = x0; x <= x0 + VW + 1; x++) if (s.tiles[y]?.[x] != null) drawTile(x, y, s.tiles[y][x], time);

    // telegraph marks (filling red circle)
    for (let i = marks.length - 1; i >= 0; i--) {
      const m = marks[i]; m.t += dt; if (m.t > m.castMs + 120) { marks.splice(i, 1); continue; }
      const f = Math.min(1, m.t / m.castMs);
      ctx.strokeStyle = 'rgba(224,80,60,.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx(m.x), sy(m.y), m.radius * TS, 0, 7); ctx.stroke();
      ctx.fillStyle = `rgba(224,80,60,${(0.18 + 0.3 * f).toFixed(2)})`;
      ctx.beginPath(); ctx.arc(sx(m.x), sy(m.y), m.radius * TS * f, 0, 7); ctx.fill();
    }
    // projectiles
    for (const p of s.projectiles) { if (!p.alive) continue; ctx.fillStyle = p.fromHero ? (p.color === 'pyroblast' ? '#ff7a2a' : '#7fd8ff') : '#e0533d'; ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), 4, 0, 7); ctx.fill(); }

    // enemies + hp bars
    for (const e of s.enemies) {
      if (!e.unit.alive) continue;
      drawUnit(e, e.unit.sprite, e.unit.boss ? 2.2 : 1.5, e.angle);
      const bw = (e.unit.boss ? 44 : 30), frac = Math.max(0, e.unit.hp / e.unit.maxHp);
      const bx = sx(e.x) - bw / 2, by = sy(e.y) - (e.unit.boss ? 40 : 26);
      ctx.fillStyle = '#000'; ctx.fillRect(bx, by, bw, 4); ctx.fillStyle = e.unit.boss ? '#e06b5e' : '#c0392b'; ctx.fillRect(bx, by, bw * frac, 4);
    }
    if (s.hero.unit.alive) {
      drawUnit(s.hero, 'hero', 1.6, s.hero.angle);
      if (s.hero.unit.blocking > 0) { ctx.strokeStyle = '#4ad6ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx(s.hero.x), sy(s.hero.y) - 4, 18, 0, 7); ctx.stroke(); }
    }
    // floating numbers
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i]; f.life -= dt; f.y -= dt * 0.0018; if (f.life <= 0) { floats.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, f.life / f.max); ctx.fillStyle = f.crit ? '#ffd24a' : f.hero ? '#ff7a6e' : '#fff2c4';
      ctx.font = f.crit ? 'bold 14px monospace' : 'bold 11px monospace'; ctx.textAlign = 'center';
      ctx.fillText(f.text, sx(f.x), sy(f.y) - 18); ctx.globalAlpha = 1; ctx.textAlign = 'left';
    }
  }

  function updateHud() {
    const h = s.hero.unit;
    hpBar.style.width = (100 * Math.max(0, h.hp) / h.maxHp) + '%';
    resBar.style.width = (100 * h.resource.value / h.resource.max) + '%';
    for (const b of buttons) {
      const ab = ABILITIES[b.dataset.id], cd = h.cooldowns[b.dataset.id] || 0;
      b.disabled = cd > 0 || h.resource.value < ab.cost || !!s.result;
      b.textContent = ab.name.split(' ')[0] + (cd > 0 ? ` ${Math.ceil(cd / 1000)}` : '');
      b.classList.toggle('active-block', (b.dataset.id === 'shield_block' || b.dataset.id === 'evasion') && h.blocking > 0);
    }
    intBtn.disabled = !dungeon.peekInteract();
  }

  // ---- joystick ----
  let sid = null, ox = 0, oy = 0;
  stick.addEventListener('pointerdown', (ev) => { sid = ev.pointerId; stick.setPointerCapture(sid); ox = ev.clientX; oy = ev.clientY; ev.preventDefault(); });
  stick.addEventListener('pointermove', (ev) => {
    if (ev.pointerId !== sid) return;
    let dx = ev.clientX - ox, dy = ev.clientY - oy; const m = Math.hypot(dx, dy) || 1, cl = Math.min(36, m);
    knob.style.transform = `translate(calc(-50% + ${(dx / m) * cl}px), calc(-50% + ${(dy / m) * cl}px))`;
    const dead = m < 10 ? 0 : 1; dungeon.setMove((dx / m) * dead, (dy / m) * dead); ev.preventDefault();
  });
  const end = (ev) => { if (ev.pointerId !== sid) return; sid = null; knob.style.transform = 'translate(-50%,-50%)'; dungeon.setMove(0, 0); };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);

  // keyboard (desktop)
  const keys = new Set();
  const KM = { w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  const applyKeys = () => { let dx = 0, dy = 0; for (const k of keys) if (KM[k]) { dx += KM[k][0]; dy += KM[k][1]; } const m = Math.hypot(dx, dy) || 1; dungeon.setMove(dx / m, dy / m); };
  const kd = (ev) => { if (KM[ev.key]) { keys.add(ev.key); applyKeys(); ev.preventDefault(); } else if (ev.key === 'e' || ev.key === ' ') intBtn.click(); else { const n = '1234'.indexOf(ev.key); if (n >= 0 && buttons[n]) buttons[n].click(); } };
  const ku = (ev) => { if (KM[ev.key]) { keys.delete(ev.key); applyKeys(); } };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);

  function frame(now) {
    const dt = Math.min(100, now - last); last = now;
    if (!s.result) dungeon.step(dt);
    render(dt, now); updateHud();
    if (!ended) raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function finish(result) { if (ended) return; ended = true; unmount(); onEnd && onEnd(result); }
  function unmount() { ended = true; cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); unsubs.forEach((u) => u()); }
  return unmount;
}
