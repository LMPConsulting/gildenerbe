import { drawSprite } from './sprites.js';
import { ABILITIES } from '../data/abilities.js';

// Renders a CombatSim and forwards ability taps. Owns NO game logic.
// Returns an unmount() that stops the rAF loop and unsubscribes.
export function mountCombatScreen(root, sim, { onEnd } = {}) {
  const W = 360, H = 200, SCALE = 5, GROUND = 150, TOP = GROUND - 16 * SCALE; // sprite top
  let speed = 1, raf = 0, last = performance.now();
  const floats = [];
  const unsubs = [];

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

  const buttons = sim.state.hero.abilities.map((id) => {
    const b = document.createElement('button');
    b.className = 'ability';
    b.dataset.id = id;
    b.onclick = () => sim.queueAbility(id);
    wrap.querySelector('.ability-row').appendChild(b);
    return b;
  });

  unsubs.push(sim.on((e) => {
    if (e.type !== 'damage') return;
    let x;
    if (e.targetId === 'hero') x = heroX + 30;
    else x = enemyX(sim.state.enemies.findIndex((u) => u.id === e.targetId)) + 30;
    floats.push({ x, y: TOP + 24, text: String(e.amount), color: e.crit ? '#ffd24a' : '#ff7a6e', life: 700 });
  }));

  function render(dt) {
    ctx.fillStyle = '#241c14'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#0f0b07'; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = '#3a2c1d'; ctx.fillRect(0, GROUND, W, 6);

    if (sim.state.hero.alive) drawSprite(ctx, 'hero', heroX, TOP, SCALE);

    sim.state.enemies.forEach((en, i) => {
      if (!en.alive) return;
      const x = enemyX(i);
      drawSprite(ctx, en.sprite, x, TOP, SCALE);
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

    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.y -= dt * 0.03; f.life -= dt;
      ctx.globalAlpha = Math.max(0, f.life / 700);
      ctx.fillStyle = f.color; ctx.font = 'bold 13px monospace';
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
      if (f.life <= 0) floats.splice(i, 1);
    }
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
