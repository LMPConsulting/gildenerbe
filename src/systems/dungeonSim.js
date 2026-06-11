// Continuous (free-movement) roguelike dungeon. Positions are floats in tile
// units; the tile grid only defines walls/chests/exit/events. Hero turns and
// moves smoothly, melee hits in a facing arc, casters fire projectiles, bosses
// drop ground AoE you dodge by walking out. Pure logic, deterministic (all RNG
// from the seed), NO DOM. Mirrors combat formulas from combatSim.js.
import { makeRng } from '../core/rng.js';
import { rollHit } from './damage.js';
import { armorDR } from './stats.js';
import { getAbility } from '../data/abilities.js';
import { makeEnemy } from '../data/enemies.js';
import { abilityBaseDamage } from './hero.js';

export const TILE = Object.freeze({ FLOOR: 0, WALL: 1, DOOR: 2, CHEST: 3, EVENT: 4, EXIT: 5, CHEST_OPEN: 6, PILLAR: 7 });

const SLICE_MS = 30;             // fixed internal sub-step
const HERO_RADIUS = 0.34;
const HALF_ARC = 1.6;            // ~92° each side: front hemisphere for melee
const PROJ_SPEED = 9;            // tiles/sec
const ORTHO = [[0, -1], [0, 1], [-1, 0], [1, 0]];

const walkable = (t) => t === TILE.FLOOR || t === TILE.DOOR || t === TILE.EVENT || t === TILE.EXIT || t === TILE.CHEST_OPEN;
const solid = (t) => t === TILE.WALL || t === TILE.PILLAR || t === TILE.CHEST;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); }

// ---------------------------------------------------------------- reachability
export function isReachable(tiles, from, to) {
  const rows = tiles.length, cols = tiles[0].length;
  const fx = Math.floor(from.x), fy = Math.floor(from.y), tx = Math.floor(to.x), ty = Math.floor(to.y);
  if (fx === tx && fy === ty) return true;
  const seen = Array.from({ length: rows }, () => new Array(cols).fill(false));
  if (!walkable(tiles[fy]?.[fx])) return false;
  seen[fy][fx] = true; const q = [[fx, fy]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of ORTHO) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || seen[ny][nx]) continue;
      if (!walkable(tiles[ny][nx])) continue;
      seen[ny][nx] = true; q.push([nx, ny]);
    }
  }
  if (walkable(tiles[ty][tx])) return seen[ty][tx];
  return ORTHO.some(([dx, dy]) => !!seen[ty + dy]?.[tx + dx]);
}

// ---------------------------------------------------------------- generation
const roomCenter = (r) => ({ x: r.x + (r.w - 1) / 2, y: r.y + (r.h - 1) / 2 });
function carveRoom(tiles, r) { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) tiles[y][x] = TILE.FLOOR; }
function carveCorridor(tiles, a, b, rng) {
  let x = Math.round(a.x), y = Math.round(a.y);
  const bx = Math.round(b.x), by = Math.round(b.y);
  const dig = () => { if (tiles[y][x] === TILE.WALL) tiles[y][x] = TILE.FLOOR; };
  const horizFirst = rng.chance(0.5);
  const stepX = () => { while (x !== bx) { x += Math.sign(bx - x); dig(); } };
  const stepY = () => { while (y !== by) { y += Math.sign(by - y); dig(); } };
  dig(); if (horizFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
}

function takeRandom(pool, rng, pred) {
  const idx = [];
  for (let i = 0; i < pool.length; i++) if (!pred || pred(pool[i])) idx.push(i);
  if (!idx.length) return null;
  return pool.splice(idx[rng.int(0, idx.length - 1)], 1)[0];
}

function tryGenerate(rng, floorDef, bossIndex, relaxed) {
  const cols = floorDef.cols ?? 17, rows = floorDef.rows ?? 12;
  const tiles = Array.from({ length: rows }, () => new Array(cols).fill(TILE.WALL));
  const rooms = [];
  if (floorDef.kind === 'boss' || relaxed) {
    const r = { x: 1, y: 1, w: cols - 2, h: rows - 2 };
    carveRoom(tiles, r); rooms.push(r);
  } else {
    const n = rng.int(4, 6);
    for (let i = 0; i < n; i++) {
      const w = rng.int(4, 6), h = rng.int(3, 5);
      const r = { x: rng.int(1, cols - 1 - w), y: rng.int(1, rows - 1 - h), w, h };
      carveRoom(tiles, r);
      if (rooms.length) carveCorridor(tiles, roomCenter(rooms[rng.int(0, rooms.length - 1)]), roomCenter(r), rng);
      rooms.push(r);
    }
  }
  const arena = rooms.length === 1;
  const spawn = arena
    ? { x: rooms[0].x + 1.5, y: rooms[0].y + rooms[0].h / 2 }
    : { x: roomCenter(rooms[0]).x, y: roomCenter(rooms[0]).y };

  // exit in the farthest spot
  let exit = null, best = -1;
  const cand = arena
    ? (() => { const a = []; for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) if (tiles[y][x] === TILE.FLOOR) a.push({ x, y }); return a; })()
    : rooms.map(roomCenter).map((c) => ({ x: Math.round(c.x), y: Math.round(c.y) }));
  for (const c of cand) {
    const d = Math.abs(c.x - spawn.x) + Math.abs(c.y - spawn.y);
    if (d > best) { best = d; exit = { x: Math.round(c.x), y: Math.round(c.y) }; }
  }
  if (!exit || (exit.x === Math.round(spawn.x) && exit.y === Math.round(spawn.y))) return null;
  tiles[exit.y][exit.x] = TILE.EXIT;

  // pillars for cover inside non-spawn rooms (not in boss arena edges)
  if (!arena) {
    for (const r of rooms.slice(1)) {
      if (r.w >= 5 && r.h >= 4 && rng.chance(0.7)) {
        const px = r.x + 1 + rng.int(0, r.w - 3), py = r.y + 1 + rng.int(0, r.h - 3);
        if (tiles[py][px] === TILE.FLOOR) tiles[py][px] = TILE.PILLAR;
      }
    }
  } else {
    // a few scattered pillars in the arena for the boss dance
    for (let i = 0; i < 4; i++) {
      const px = rng.int(3, cols - 4), py = rng.int(2, rows - 3);
      if (tiles[py][px] === TILE.FLOOR && Math.abs(px - spawn.x) > 2) tiles[py][px] = TILE.PILLAR;
    }
  }

  const pool = [];
  for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) {
    if (tiles[y][x] === TILE.FLOOR && !(x === Math.round(spawn.x) && y === Math.round(spawn.y))) pool.push({ x, y });
  }
  const away = (c) => Math.max(Math.abs(c.x - spawn.x), Math.abs(c.y - spawn.y)) > 2;

  const enemyPos = [];
  const centre = { x: Math.round(roomCenter(rooms[0]).x), y: Math.round(roomCenter(rooms[0]).y) };
  for (let i = 0; i < (floorDef.enemies?.length ?? 0); i++) {
    let cell = null;
    if (arena && i === bossIndex) {
      const ci = pool.findIndex((c) => c.x === Math.round(cols / 2) && tiles[c.y][c.x] === TILE.FLOOR);
      cell = ci >= 0 ? pool.splice(ci, 1)[0] : null;
    }
    if (!cell) cell = takeRandom(pool, rng, away) ?? (relaxed ? takeRandom(pool, rng) : null);
    if (!cell) return null;
    enemyPos.push(cell);
  }
  const placed = [];
  for (let i = 0; i < (floorDef.chests ?? 0); i++) { const c = takeRandom(pool, rng); if (!c) return null; tiles[c.y][c.x] = TILE.CHEST; placed.push(c); }
  for (let i = 0; i < (floorDef.events ?? 0); i++) { const c = takeRandom(pool, rng); if (!c) return null; tiles[c.y][c.x] = TILE.EVENT; placed.push(c); }

  if (!relaxed) {
    for (const t of [exit, ...placed, ...enemyPos]) if (!isReachable(tiles, spawn, t)) return null;
  }
  return { cols, rows, tiles, spawn, exit, enemyPos };
}

function generateFloor(rng, floorDef, bossIndex) {
  for (let i = 0; i < 80; i++) { const g = tryGenerate(rng, floorDef, bossIndex, false); if (g) return g; }
  const g = tryGenerate(rng, floorDef, bossIndex, true);
  if (!g) throw new Error('Dungeon-Generierung fehlgeschlagen');
  return g;
}

// ----------------------------------------------------------------- simulation
export function createDungeon({ hero, floorDef, seed = 1 }) {
  const rng = makeRng(seed);
  const listeners = new Set();
  const pending = [];
  const units = (floorDef.enemies ?? []).map((id, i) => {
    const u = makeEnemy(id);
    u.uid = `${id}#${i}`;
    return u;
  });
  let bossIndex = units.findIndex((u) => u.boss);
  if (bossIndex < 0 && floorDef.kind === 'boss' && units.length) bossIndex = 0;
  const gen = generateFloor(rng, floorDef, bossIndex);

  const state = {
    cols: gen.cols, rows: gen.rows, tiles: gen.tiles,
    hero: { x: gen.spawn.x + 0.0, y: gen.spawn.y + 0.0, angle: 0, unit: hero, r: HERO_RADIUS },
    enemies: units.map((u, i) => ({
      x: gen.enemyPos[i].x + 0.5, y: gen.enemyPos[i].y + 0.5, angle: Math.PI, unit: u,
      r: u.boss ? 0.55 : 0.36, behavior: u.behavior || 'chaser',
      fireTimer: u.attackEvery || u.autoAttackEvery, charge: null,
      _slowMs: 0, _rootMs: 0, _spd: 0, chargeCd: 0,
    })),
    projectiles: [], telegraphs: [],
    result: null, bossDown: false, floorDef, time: 0,
  };
  const emit = (type, data) => { for (const fn of listeners) fn({ type, ...data }); };
  const move = { dx: 0, dy: 0 };
  const heroSpeed = hero.classId === 'schurke' ? 3.9 : hero.weaponKind === 'ranged' ? 3.0 : 3.3;

  const tileAt = (x, y) => (x >= 0 && y >= 0 && x < state.cols && y < state.rows ? state.tiles[y | 0][x | 0] : TILE.WALL);
  function blocked(x, y, r) {
    for (const [ox, oy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) if (solid(tileAt(x + ox, y + oy))) return true;
    return false;
  }
  function slide(u, dx, dy, dt) {
    if (!dx && !dy) return;
    const len = Math.hypot(dx, dy) || 1;
    const nx = u.x + (dx / len) * heroSpeedFor(u) * dt;
    const ny = u.y + (dy / len) * heroSpeedFor(u) * dt;
    if (!blocked(nx, u.y, u.r)) u.x = nx;
    if (!blocked(u.x, ny, u.r)) u.y = ny;
  }
  function heroSpeedFor(u) { return u === state.hero ? heroSpeed : u._spd; }

  const aliveEnemies = () => state.enemies.filter((e) => e.unit.alive);

  function applyDamage(src, target, baseDamage, extra) {
    const dr = armorDR(target.armor, src.level || 1);
    const { amount, crit } = rollHit({ baseDamage, critChance: src.critChance ?? 0.05, targetDR: dr }, rng);
    let dealt = amount;
    if (target === hero && hero.blocking > 0) dealt = Math.round(amount * (1 - (hero.blockReduce ?? 0.6)));
    target.hp = Math.max(0, target.hp - dealt);
    emit('damage', { sourceId: src.uid ?? src.id, targetId: target.uid ?? target.id, amount: dealt, crit, ...(extra || {}) });
    if (target.hp === 0 && target.alive) kill(target);
    return dealt;
  }
  function kill(unit) {
    unit.alive = false;
    emit('death', { id: unit.uid ?? unit.id });
    if (unit === hero) { state.result = 'fallen'; emit('end', { result: 'fallen' }); return; }
    if (state.floorDef.kind === 'boss' && state.enemies.every((e) => !e.unit.alive)) state.bossDown = true;
  }
  function gainRage(u, amt) { if (u.resource?.type === 'rage') u.resource.value = Math.min(u.resource.max, u.resource.value + amt); }

  // enemies within `range` of the hero, inside the facing arc (or 360 if full)
  function heroTargets(range, full) {
    return aliveEnemies().filter((e) => {
      const d = dist(e, state.hero) - e.r;
      if (d > range) return false;
      if (full) return true;
      return angDiff(Math.atan2(e.y - state.hero.y, e.x - state.hero.x), state.hero.angle) <= HALF_ARC;
    }).sort((a, b) => dist(a, state.hero) - dist(b, state.hero));
  }
  function nearestEnemy() { const a = aliveEnemies(); if (!a.length) return null; return a.reduce((p, e) => dist(e, state.hero) < dist(p, state.hero) ? e : p); }

  function spawnProjectile(src, tx, ty, baseDamage, opts = {}) {
    const a = Math.atan2(ty - (opts.fromY ?? src.y ?? state.hero.y), tx - (opts.fromX ?? src.x ?? state.hero.x));
    state.projectiles.push({
      x: opts.fromX ?? src.x ?? state.hero.x, y: opts.fromY ?? src.y ?? state.hero.y,
      vx: Math.cos(a) * PROJ_SPEED, vy: Math.sin(a) * PROJ_SPEED,
      baseDamage, fromHero: opts.fromHero, travelled: 0, range: opts.range ?? 8,
      slowMs: opts.slowMs || 0, color: opts.color, r: 0.25, alive: true,
    });
    emit('projectile', { fromHero: !!opts.fromHero });
  }

  function processPending() {
    while (pending.length) {
      const id = pending.shift();
      const ab = getAbility(id);
      if (!ab || !hero.alive) continue;
      const res = hero.resource;
      if (res && res.value < ab.cost) continue;
      if ((hero.cooldowns[id] ?? 0) > 0) continue;
      if (res) res.value -= ab.cost;
      hero.cooldowns[id] = ab.cooldown;
      const baseDmg = abilityBaseDamage(hero, ab);
      if (ab.kind === 'attack' || ab.kind === 'execute') {
        const t = heroTargets(ab.range, false)[0];
        if (t) {
          state.hero.angle = Math.atan2(t.y - state.hero.y, t.x - state.hero.x);
          let dmg = baseDmg;
          if (ab.kind === 'execute') { const below = t.unit.hp / t.unit.maxHp <= ab.threshold; if (!below && !ab.spellCoef) dmg = hero.weaponDmg * ab.weaponCoef * 0.4 + hero.ap * ab.apCoef; }
          applyDamage(hero, t.unit, dmg);
        }
      } else if (ab.kind === 'aoe') {
        for (const t of heroTargets(ab.range, true)) applyDamage(hero, t.unit, baseDmg);
      } else if (ab.kind === 'nova') {
        for (const t of heroTargets(ab.range, true)) { applyDamage(hero, t.unit, baseDmg); t._rootMs = ab.rootMs || 0; }
        emit('nova', { x: state.hero.x, y: state.hero.y, radius: ab.range });
      } else if (ab.kind === 'ranged') {
        const t = nearestEnemy();
        const tx = t ? t.x : state.hero.x + Math.cos(state.hero.angle) * ab.range;
        const ty = t ? t.y : state.hero.y + Math.sin(state.hero.angle) * ab.range;
        if (t) state.hero.angle = Math.atan2(ty - state.hero.y, tx - state.hero.x);
        spawnProjectile(state.hero, tx, ty, baseDmg, { fromHero: true, range: ab.range, slowMs: ab.slowMs, color: id });
      } else if (ab.kind === 'defensive') {
        hero.blocking = ab.blockMs; hero.blockReduce = ab.blockReduce;
      }
      emit('ability', { id });
    }
  }

  function regenResource(u, dt) {
    const r = u.resource; if (!r) return;
    if (r.regenPerSec) r.value = Math.min(r.max, r.value + r.regenPerSec * (dt / 1000));
  }
  function decay(u, dt) {
    for (const k of Object.keys(u.cooldowns)) u.cooldowns[k] = Math.max(0, u.cooldowns[k] - dt);
    if (u.blocking > 0) u.blocking = Math.max(0, u.blocking - dt);
  }

  function heroAutoAttack(dt) {
    hero.autoAttackTimer -= dt;
    if (hero.autoAttackTimer > 0) return;
    if (hero.weaponKind === 'ranged') {
      const t = nearestEnemy();
      if (!t || dist(t, state.hero) > 7) { hero.autoAttackTimer = 0; return; }
      hero.autoAttackTimer += hero.autoAttackEvery;
      state.hero.angle = Math.atan2(t.y - state.hero.y, t.x - state.hero.x);
      spawnProjectile(state.hero, t.x, t.y, hero.weaponDmg + hero.spellPower * 0.5, { fromHero: true, range: 7, color: 'auto' });
    } else {
      const t = heroTargets(1.45, false)[0];
      if (!t) { hero.autoAttackTimer = 0; return; }
      hero.autoAttackTimer += hero.autoAttackEvery;
      applyDamage(hero, t.unit, hero.weaponDmg + hero.ap * 0.3);
      gainRage(hero, hero.resource?.fromHit || 0);
    }
  }

  function stepProjectiles(dt) {
    const s = dt / 1000;
    for (const p of state.projectiles) {
      if (!p.alive) continue;
      const stepLen = PROJ_SPEED * s;
      p.x += p.vx * s; p.y += p.vy * s; p.travelled += stepLen;
      if (solid(tileAt(p.x, p.y)) || p.travelled > p.range) { p.alive = false; continue; }
      if (p.fromHero) {
        for (const e of aliveEnemies()) {
          if (dist(p, e) <= e.r + p.r) {
            applyDamage(hero, e.unit, p.baseDamage);
            if (p.slowMs) e._slowMs = p.slowMs;
            p.alive = false; break;
          }
        }
      } else if (hero.alive && dist(p, state.hero) <= HERO_RADIUS + p.r) {
        // enemy projectile -> hero (source uses generic level 1 scaling already baked)
        applyDamage({ id: 'shot', level: p.srcLevel || 1, critChance: 0.05 }, hero, p.baseDamage);
        p.alive = false;
      }
    }
    if (state.projectiles.length > 40) state.projectiles = state.projectiles.filter((p) => p.alive);
  }

  function stepTelegraphs(dt) {
    for (const tg of state.telegraphs) {
      tg.remainingMs -= dt;
      if (tg.remainingMs <= 0 && !tg.done) {
        tg.done = true;
        const hit = Math.hypot(state.hero.x - tg.x, state.hero.y - tg.y) <= tg.radius;
        if (hit && hero.alive) applyDamage({ id: tg.src, level: tg.level, critChance: 0.05 }, hero, tg.baseDamage);
        emit('telegraphResolve', { hit });
      }
    }
    state.telegraphs = state.telegraphs.filter((t) => t.remainingMs > -150);
  }

  function stepEnemy(e, dt) {
    const u = e.unit;
    e._spd = (u.speed || 2.4) * (e._slowMs > 0 ? 0.5 : 1) * (u.enraged ? 1.25 : 1);
    if (e._slowMs > 0) e._slowMs -= dt;
    if (e._rootMs > 0) { e._rootMs -= dt; }
    decay(u, dt);
    const toHero = { x: state.hero.x - e.x, y: state.hero.y - e.y };
    const d = Math.hypot(toHero.x, toHero.y);
    e.angle = Math.atan2(toHero.y, toHero.x);
    const aggro = d <= (u.aggro || 6);

    // separation from other enemies (avoid stacking)
    let sx = 0, sy = 0;
    for (const o of state.enemies) { if (o === e || !o.unit.alive) continue; const dd = dist(e, o); if (dd < 0.85 && dd > 0.001) { sx += (e.x - o.x) / dd; sy += (e.y - o.y) / dd; } }

    if (e._rootMs > 0) { /* frozen in place */ }
    else if (e.behavior === 'ranged') {
      // kite: keep ~4.5 tiles; fire on cooldown
      const ideal = 4.5;
      let mx = 0, my = 0;
      if (aggro) { if (d < ideal - 0.5) { mx = -toHero.x; my = -toHero.y; } else if (d > ideal + 0.8) { mx = toHero.x; my = toHero.y; } }
      slide(e, mx + sx * 0.6, my + sy * 0.6, dt / 1000);
      e.fireTimer -= dt;
      if (aggro && e.fireTimer <= 0 && d < 7) { e.fireTimer = u.attackEvery || 2600; spawnProjectile(e, state.hero.x, state.hero.y, u.weaponDmg, { fromX: e.x, fromY: e.y, range: 8, color: 'enemy' }); }
    } else if (e.behavior === 'charger') {
      if (e.charge) {
        e.charge.t -= dt;
        if (e.charge.t <= 0) { slide(e, e.charge.dx, e.charge.dy, (dt / 1000) * 3.2); if (orthHit(e)) endCharge(e); if ((e.charge.dur -= dt) <= 0) e.charge = null; }
      } else if (aggro && d < 4.5 && (e.chargeCd = (e.chargeCd || 0) - dt) <= 0) {
        e.chargeCd = 3500; e.charge = { t: 600, dur: 700, dx: toHero.x, dy: toHero.y }; emit('telegraphMark', { x: e.x + toHero.x, y: e.y + toHero.y, radius: 0.6, castMs: 600, charge: true });
      } else if (aggro && d > 1.4) { slide(e, toHero.x + sx, toHero.y + sy, dt / 1000); }
      meleeSwing(e, u, d, dt);
    } else { // chaser (default) + boss
      if (aggro && d > 1.3) slide(e, toHero.x + sx * 0.8, toHero.y + sy * 0.8, dt / 1000);
      else if (sx || sy) slide(e, sx, sy, dt / 1000);
      meleeSwing(e, u, d, dt);
      if (u.ai && u.boss) bossTelegraph(e, u, dt);
    }
    if (u.phase2At && !u.enraged && u.hp / u.maxHp <= u.phase2At) { u.enraged = true; emit('enrage', { id: u.uid }); }
  }
  function meleeSwing(e, u, d, dt) {
    u.autoAttackTimer -= dt;
    if (u.autoAttackTimer <= 0) {
      if (d <= 1.35 && hero.alive) { u.autoAttackTimer += u.autoAttackEvery; applyDamage(u, hero, u.weaponDmg + (u.ap || 0) * 0.3); }
      else u.autoAttackTimer = 0;
    }
  }
  function orthHit(e) { return dist(e, state.hero) <= HERO_RADIUS + e.r + 0.05; }
  function endCharge(e) { if (hero.alive) applyDamage(e.unit, hero, e.unit.weaponDmg * 1.6); e.charge = null; }
  function bossTelegraph(e, u, dt) {
    u.ai.timer -= dt;
    if (u.ai.timer <= 0) {
      u.ai.timer = u.ai.special.everyMs;
      state.telegraphs.push({ x: state.hero.x, y: state.hero.y, radius: 1.8, remainingMs: u.ai.special.castMs, baseDamage: u.weaponDmg * u.ai.special.mult, src: u.uid, level: u.level });
      emit('telegraphMark', { x: state.hero.x, y: state.hero.y, radius: 1.8, castMs: u.ai.special.castMs });
    }
  }

  function tick(dt) {
    processPending();
    if (state.result) return;
    decay(hero, dt); regenResource(hero, dt);
    slide(state.hero, move.dx, move.dy, dt / 1000);
    if (move.dx || move.dy) hero.facingMove = state.hero.angle = Math.atan2(move.dy, move.dx);
    heroAutoAttack(dt);
    if (state.result) return;
    for (const e of state.enemies) { if (!e.unit.alive) continue; stepEnemy(e, dt); if (state.result) return; }
    stepProjectiles(dt);
    stepTelegraphs(dt);
  }

  function step(dt) {
    if (state.result) return;
    let rem = dt;
    while (rem > 0 && !state.result) { const s = Math.min(SLICE_MS, rem); state.time += s; tick(s); rem -= s; }
  }
  function setMove(dx, dy) { move.dx = Math.max(-1, Math.min(1, dx)); move.dy = Math.max(-1, Math.min(1, dy)); }
  function queueAbility(id) {
    const ab = getAbility(id);
    if (!ab || state.result || !hero.alive) return false;
    const res = hero.resource;
    if (res && res.value < ab.cost) return false;
    if ((hero.cooldowns[id] ?? 0) > 0) return false;
    pending.push(id); return true;
  }
  function nearTile(codes, reach) {
    const hx = state.hero.x, hy = state.hero.y;
    for (let y = (hy - reach) | 0; y <= ((hy + reach) | 0); y++) {
      for (let x = (hx - reach) | 0; x <= ((hx + reach) | 0); x++) {
        if (codes.includes(tileAt(x, y)) && Math.hypot(hx - (x + 0.5), hy - (y + 0.5)) <= reach) return { x, y };
      }
    }
    return null;
  }
  function peekInteract() {
    if (state.result) return null;
    const chest = nearTile([TILE.CHEST], 1.0);
    if (chest) return { type: 'chest', ...chest };
    const event = nearTile([TILE.EVENT], 1.0);
    if (event) return { type: 'event', ...event };
    const exit = nearTile([TILE.EXIT], 0.8);
    if (exit && (state.floorDef.kind !== 'boss' || state.bossDown)) return { type: 'exit' };
    return null;
  }
  function interact() {
    const f = peekInteract();
    if (!f) return null;
    if (f.type === 'chest') { state.tiles[f.y][f.x] = TILE.CHEST_OPEN; emit('loot', {}); return { type: 'chest' }; }
    if (f.type === 'event') { state.tiles[f.y][f.x] = TILE.FLOOR; return { type: 'event' }; }
    state.result = 'cleared'; emit('end', { result: 'cleared' }); return { type: 'exit' };
  }

  return { state, step, setMove, queueAbility, interact, peekInteract, on(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
}
