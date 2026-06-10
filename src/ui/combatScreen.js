import { drawSprite } from './sprites.js';
import { ABILITIES } from '../data/abilities.js';

// Renders a CombatSim and forwards ability taps. Owns NO game logic.
// Returns an unmount() that stops the rAF loop and unsubscribes.
export function mountCombatScreen(root, sim, { onEnd } = {}) {
  const W = 360, H = 200, SCALE = 5, GROUND = 150, TOP = GROUND - 16 * SCALE; // sprite top
  const SPR = 16 * SCALE; // sprite box size in px
  let speed = 1, raf = 0, last = performance.now();
  const floats = [];
  const unsubs = [];

  // --- juice state: screen shake, hit flashes, pooled particles ---
  const SHAKE_PX = 7, MAX_FLOATS = 14, MAX_PARTICLES = 128;
  let trauma = 0;                               // 0..1, decays linearly each frame
  const flashes = Object.create(null);          // unitId -> { t, dur, dir }
  const particles = [];                         // fixed pool, no per-frame allocation
  for (let i = 0; i < MAX_PARTICLES; i++) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: '#fff', grav: 0 });
  }
  let pCursor = 0;
  const CRIT_SPARKS = ['#ffd24a', '#fff3c4', '#ff9d3c', '#f2f4ef'];
  const HIT_SPARKS = ['#ffb47a', '#e8dcc0'];
  const DEATH_BITS = ['#e8dcc0', '#9b8d7c'];
  const PUFF_SMOKE = ['#5a5048', '#776a5c', '#3a322b', '#9b8d7c'];

  const addShake = (amount) => { trauma = Math.min(1, trauma + amount); };

  function spawnParticle(x, y, vx, vy, life, size, color, grav) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      pCursor = (pCursor + 1) % MAX_PARTICLES;
      const p = particles[pCursor];
      if (p.active) continue;                   // pool full -> drop, hard cap
      p.active = true;
      p.x = x; p.y = y; p.vx = vx; p.vy = vy;
      p.life = life; p.max = life; p.size = size; p.color = color; p.grav = grav;
      return;
    }
  }

  // radial spark burst (crits, impacts)
  function burst(cx, cy, n, colors, force) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = force * (0.4 + Math.random() * 0.6);
      spawnParticle(
        cx, cy,
        Math.cos(a) * v, Math.sin(a) * v - force * 0.4,
        240 + Math.random() * 260,
        1 + Math.random() * 2,
        colors[(Math.random() * colors.length) | 0],
        0.0009,
      );
    }
  }

  // slow rising smoke puff (deaths)
  function puff(cx, cy) {
    for (let i = 0; i < 18; i++) {
      spawnParticle(
        cx + (Math.random() * 20 - 10), cy + (Math.random() * 16 - 8),
        (Math.random() * 2 - 1) * 0.035, -0.015 - Math.random() * 0.05,
        420 + Math.random() * 340,
        2 + Math.random() * 3,
        PUFF_SMOKE[(Math.random() * PUFF_SMOKE.length) | 0],
        -0.00005,
      );
    }
  }

  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'combat';
  wrap.innerHTML = `
    <canvas class="combat-canvas" width="${W}" height="${H}"></canvas>
    <div class="combat-hud">
      <div class="bar hp"><i></i><label>HP</label></div>
      <div class="bar rage"><i></i><label>Wut</label></div>
    </div>
    <div class="ability-row"></div>
    <button class="speed-btn">1×</button>
  `;
  root.appendChild(wrap);

  const canvas = wrap.querySelector('.combat-canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const hpBar = wrap.querySelector('.bar.hp i');
  const rageBar = wrap.querySelector('.bar.rage i');
  const speedBtn = wrap.querySelector('.speed-btn');
  speedBtn.onclick = () => { speed = speed === 1 ? 2 : 1; speedBtn.textContent = speed + '×'; };

  const heroX = 44;
  const count = () => sim.state.enemies.length;
  function enemyX(i) {
    const n = count();
    if (n <= 1) return 250;
    const start = 180, span = 110;
    return start + i * (span / (n - 1));
  }

  function unitX(id) {
    if (id === 'hero') return heroX;
    const i = sim.state.enemies.findIndex((u) => u.id === id);
    return i < 0 ? 250 : enemyX(i);
  }

  const buttons = sim.state.hero.abilities.map((id) => {
    const b = document.createElement('button');
    b.className = 'ability';
    b.dataset.id = id;
    b.onclick = () => sim.queueAbility(id);
    wrap.querySelector('.ability-row').appendChild(b);
    return b;
  });

  unsubs.push(sim.on((e) => {
    if (e.type === 'damage') {
      const cx = unitX(e.targetId) + SPR / 2;
      flashes[e.targetId] = { t: 0, dur: e.crit ? 190 : 110, dir: e.targetId === 'hero' ? -1 : 1 };
      addShake(e.crit ? 0.55 : 0.22);
      if (e.crit) burst(cx, TOP + 44, 14, CRIT_SPARKS, 0.17);
      else burst(cx, TOP + 46, 4, HIT_SPARKS, 0.09);
      if (floats.length >= MAX_FLOATS) floats.shift();
      floats.push({
        x: cx + (e.crit ? Math.round(Math.random() * 12 - 6) : 0),
        y: TOP + 20,
        text: String(e.amount),
        crit: !!e.crit,
        age: 0,
        life: e.crit ? 900 : 700,
      });
    } else if (e.type === 'death') {
      const cx = unitX(e.id) + SPR / 2;
      addShake(0.4);
      puff(cx, TOP + 52);
      burst(cx, TOP + 48, 6, DEATH_BITS, 0.12);
    }
  }));

  // offscreen buffer used to tint a single sprite for the hit flash
  const fxCanvas = document.createElement('canvas');
  fxCanvas.width = SPR; fxCanvas.height = SPR;
  const fxCtx = fxCanvas.getContext('2d');
  fxCtx.imageSmoothingEnabled = false;

  function drawUnit(spriteKey, x, id) {
    const f = flashes[id];
    if (!f) { drawSprite(ctx, spriteKey, x, TOP, SCALE); return; }
    const k = 1 - f.t / f.dur;                  // 1 -> 0 over the flash
    fxCtx.clearRect(0, 0, SPR, SPR);
    drawSprite(fxCtx, spriteKey, 0, 0, SCALE);
    fxCtx.globalCompositeOperation = 'source-atop';
    fxCtx.fillStyle = 'rgba(255,236,200,' + (0.85 * k).toFixed(3) + ')';
    fxCtx.fillRect(0, 0, SPR, SPR);
    fxCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(fxCanvas, x + Math.round(f.dir * 3 * k), TOP); // tiny knockback nudge
  }

  function drawShadow(x) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x + 14, GROUND + 1, SPR - 28, 3);
    ctx.fillRect(x + 22, GROUND + 4, SPR - 44, 2);
  }

  function render(dt) {
    // tick juice timers (real time, unaffected by sim speed)
    trauma = Math.max(0, trauma - dt / 320);
    for (const id in flashes) {
      const f = flashes[id];
      f.t += dt;
      if (f.t >= f.dur) delete flashes[id];
    }

    // backdrop always covers the full canvas so shake never exposes gaps
    ctx.fillStyle = '#241c14'; ctx.fillRect(0, 0, W, H);

    const sx = trauma > 0 ? Math.round((Math.random() * 2 - 1) * SHAKE_PX * trauma) : 0;
    const sy = trauma > 0 ? Math.round((Math.random() * 2 - 1) * SHAKE_PX * trauma * 0.6) : 0;
    ctx.save();
    ctx.translate(sx, sy);

    // ground, overdrawn past both edges to survive the shake offset
    ctx.fillStyle = '#0f0b07'; ctx.fillRect(-8, GROUND, W + 16, H - GROUND + 8);
    ctx.fillStyle = '#3a2c1d'; ctx.fillRect(-8, GROUND, W + 16, 6);

    if (sim.state.hero.alive) { drawShadow(heroX); drawUnit('hero', heroX, 'hero'); }

    sim.state.enemies.forEach((en, i) => {
      if (!en.alive) return;
      const x = enemyX(i);
      drawShadow(x);
      drawUnit(en.sprite, x, en.id);
      const bw = 50, frac = Math.max(0, en.hp / en.maxHp);
      ctx.fillStyle = '#e8dcc0'; ctx.font = '8px monospace';
      ctx.fillText(en.name.length > 13 ? en.name.slice(0, 12) + '…' : en.name, x, TOP - 14);
      ctx.fillStyle = '#000'; ctx.fillRect(x, TOP - 10, bw, 5);
      ctx.fillStyle = '#c0392b'; ctx.fillRect(x, TOP - 10, bw * frac, 5);
      if (en.telegraph) {
        const tf = Math.max(0, Math.min(1, 1 - en.telegraph.remainingMs / en.ai.special.castMs));
        ctx.fillStyle = '#000'; ctx.fillRect(x, TOP - 22, bw, 5);
        ctx.fillStyle = '#ffb300'; ctx.fillRect(x, TOP - 22, bw * tf, 5);
        ctx.fillStyle = '#ffb300'; ctx.font = 'bold 10px monospace'; ctx.fillText('!', x + bw + 3, TOP - 17);
      }
    });

    // particles (pooled, hard-capped)
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const a = p.life / p.max;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      const sz = Math.max(1, Math.round(p.size * (0.4 + 0.6 * a)));
      ctx.fillRect(Math.round(p.x - sz / 2), Math.round(p.y - sz / 2), sz, sz);
    }
    ctx.globalAlpha = 1;

    // floating damage numbers: scale-pop on spawn, then rise + fade
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.age += dt;
      if (f.age >= f.life) { floats.splice(i, 1); continue; }
      const t = f.age / f.life;
      const pop = Math.min(1, f.age / 140);
      const k = 1 + (f.crit ? 1.5 : 0.8) * (1 - pop) * (1 - pop);
      const rise = Math.max(0, f.age - 120) * 0.035;
      ctx.save();
      ctx.translate(Math.round(f.x), Math.round(f.y - rise));
      ctx.scale(k, k);
      ctx.globalAlpha = t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.4);
      ctx.font = 'bold ' + (f.crit ? 15 : 12) + 'px monospace';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(15,10,6,0.85)';
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.crit ? '#ffd24a' : '#ff8a73';
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }

    ctx.restore(); // undo shake translate
  }

  function updateHud() {
    const h = sim.state.hero;
    hpBar.style.width = (100 * Math.max(0, h.hp) / h.maxHp) + '%';
    rageBar.style.width = (100 * h.resource.value / h.resource.max) + '%';
    for (const b of buttons) {
      const ab = ABILITIES[b.dataset.id];
      const cd = h.cooldowns[b.dataset.id] || 0;
      b.disabled = cd > 0 || h.resource.value < ab.cost || !!sim.state.result;
      b.textContent = ab.name + (cd > 0 ? ` ${Math.ceil(cd / 1000)}s` : '');
      b.classList.toggle('active-block', b.dataset.id === 'shield_block' && h.blocking > 0);
    }
  }

  function frame(now) {
    const dt = Math.min(100, now - last); last = now;
    if (!sim.state.result) sim.step(dt * speed);
    render(dt); updateHud();
    if (sim.state.result) { unmount(); onEnd?.(sim.state.result); return; }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function unmount() {
    cancelAnimationFrame(raf);
    unsubs.forEach((u) => u());
  }
  return unmount;
}
