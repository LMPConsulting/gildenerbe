// Walkable roguelike dungeon floor: seeded room+corridor generation, tile-step
// movement, melee auto-combat and boss telegraphs. Pure logic, NO DOM.
// Damage / ability / cooldown formulas mirror combatSim.js 1:1 so balance
// carries over (rollHit + armorDR, +10 Wut per hero auto-hit, SLICE stepping).
import { makeRng } from '../core/rng.js';
import { rollHit } from './damage.js';
import { armorDR } from './stats.js';
import { getAbility } from '../data/abilities.js';
import { makeEnemy } from '../data/enemies.js';

const SLICE = 50;          // ms — fixed internal sub-step, like combatSim
const HERO_STEP_MS = 160;  // hero walks 1 tile per 160ms while a direction is held
const ENEMY_STEP_MS = 400; // an aggroed enemy steps every 400ms
const AGGRO_RANGE = 4;     // Chebyshev distance that wakes an enemy
const GEN_ATTEMPTS = 60;   // regeneration budget until the floor is connected

// tiles[y][x] codes
export const TILE = Object.freeze({
  FLOOR: 0, WALL: 1, DOOR: 2, CHEST: 3, EVENT: 4, EXIT: 5, CHEST_OPEN: 6,
});

const ORTHO = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const walkableTile = (t) =>
  t === TILE.FLOOR || t === TILE.DOOR || t === TILE.EVENT || t === TILE.EXIT || t === TILE.CHEST_OPEN;

// BFS reachability over walkable tiles. A solid-but-interactable target
// (chest) counts as reached when any of its 4 neighbours was reached.
export function isReachable(tiles, from, to) {
  const rows = tiles.length, cols = tiles[0].length;
  if (from.x === to.x && from.y === to.y) return true;
  if (!walkableTile(tiles[from.y]?.[from.x])) return false;
  const seen = Array.from({ length: rows }, () => new Array(cols).fill(false));
  seen[from.y][from.x] = true;
  const q = [[from.x, from.y]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of ORTHO) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || seen[ny][nx]) continue;
      if (!walkableTile(tiles[ny][nx])) continue;
      seen[ny][nx] = true;
      q.push([nx, ny]);
    }
  }
  if (walkableTile(tiles[to.y][to.x])) return seen[to.y][to.x];
  return ORTHO.some(([dx, dy]) => !!seen[to.y + dy]?.[to.x + dx]);
}

// ---------------------------------------------------------------- generation

const roomCenter = (r) => ({ x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) });

function carveRoom(tiles, r) {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) tiles[y][x] = TILE.FLOOR;
  }
}

// L-shaped corridor between two interior points (never touches the border).
function carveCorridor(tiles, a, b) {
  let x = a.x, y = a.y;
  const dig = () => { if (tiles[y][x] === TILE.WALL) tiles[y][x] = TILE.FLOOR; };
  dig();
  while (x !== b.x) { x += Math.sign(b.x - x); dig(); }
  while (y !== b.y) { y += Math.sign(b.y - y); dig(); }
}

// removes and returns a random pool cell matching pred, or null
function takeRandom(pool, rng, pred) {
  const idx = [];
  for (let i = 0; i < pool.length; i++) if (!pred || pred(pool[i])) idx.push(i);
  if (!idx.length) return null;
  return pool.splice(idx[rng.int(0, idx.length - 1)], 1)[0];
}

// One generation attempt. Returns { cols, rows, tiles, spawn, exit, enemyPos }
// or null when placement failed / the floor is not fully connected.
// `relaxed` is the safety-net mode: one open arena, looser placement, no veto.
function tryGenerate(rng, floorDef, bossIndex, relaxed) {
  const cols = floorDef.cols ?? 13;
  const rows = floorDef.rows ?? 9;
  const tiles = Array.from({ length: rows }, () => new Array(cols).fill(TILE.WALL));
  const rooms = [];

  if (floorDef.kind === 'boss' || relaxed) {
    // one big arena instead of a room maze
    const r = { x: 1, y: 1, w: cols - 2, h: rows - 2 };
    carveRoom(tiles, r);
    rooms.push(r);
  } else {
    const n = rng.int(3, 5);
    for (let i = 0; i < n; i++) {
      const w = rng.int(3, Math.min(5, cols - 4));
      const h = rng.int(3, Math.min(4, rows - 4));
      const r = { x: rng.int(1, cols - 1 - w), y: rng.int(1, rows - 1 - h), w, h };
      carveRoom(tiles, r);
      if (rooms.length) carveCorridor(tiles, roomCenter(rooms[rooms.length - 1]), roomCenter(r));
      rooms.push(r);
    }
  }

  const arena = rooms.length === 1;
  const spawn = arena
    ? { x: rooms[0].x + 1, y: rooms[0].y + Math.floor(rooms[0].h / 2) } // west edge, boss owns the centre
    : roomCenter(rooms[0]);

  // exit in the farthest room (arena: the farthest floor tile)
  let exit = null, best = -1;
  if (arena) {
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        if (tiles[y][x] !== TILE.FLOOR) continue;
        const d = Math.abs(x - spawn.x) + Math.abs(y - spawn.y);
        if (d > best) { best = d; exit = { x, y }; }
      }
    }
  } else {
    for (const r of rooms) {
      const c = roomCenter(r);
      const d = Math.abs(c.x - spawn.x) + Math.abs(c.y - spawn.y);
      if (d > best) { best = d; exit = c; }
    }
  }
  if (!exit || (exit.x === spawn.x && exit.y === spawn.y)) return null;
  tiles[exit.y][exit.x] = TILE.EXIT;

  // placement pool: every floor tile except the spawn
  const pool = [];
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (tiles[y][x] === TILE.FLOOR && !(x === spawn.x && y === spawn.y)) pool.push({ x, y });
    }
  }
  const awayFromSpawn = (c) => Math.max(Math.abs(c.x - spawn.x), Math.abs(c.y - spawn.y)) > 1;

  const enemyPos = [];
  const centre = roomCenter(rooms[0]);
  for (let i = 0; i < (floorDef.enemies?.length ?? 0); i++) {
    let cell = null;
    if (arena && i === bossIndex) {
      const ci = pool.findIndex((c) => c.x === centre.x && c.y === centre.y);
      if (ci >= 0) cell = pool.splice(ci, 1)[0];
    }
    if (!cell) cell = takeRandom(pool, rng, awayFromSpawn) ?? (relaxed ? takeRandom(pool, rng) : null);
    if (!cell) return null;
    enemyPos.push(cell);
  }

  const placed = [];
  for (let i = 0; i < (floorDef.chests ?? 0); i++) {
    const cell = takeRandom(pool, rng);
    if (!cell) return null;
    tiles[cell.y][cell.x] = TILE.CHEST;
    placed.push(cell);
  }
  for (let i = 0; i < (floorDef.events ?? 0); i++) {
    const cell = takeRandom(pool, rng);
    if (!cell) return null;
    tiles[cell.y][cell.x] = TILE.EVENT;
    placed.push(cell);
  }

  // connectivity veto: spawn must reach exit + every chest/event/enemy tile
  if (!relaxed) {
    for (const t of [exit, ...placed, ...enemyPos]) {
      if (!isReachable(tiles, spawn, t)) return null;
    }
  }
  return { cols, rows, tiles, spawn, exit, enemyPos };
}

function generateFloor(rng, floorDef, bossIndex) {
  for (let i = 0; i < GEN_ATTEMPTS; i++) {
    const g = tryGenerate(rng, floorDef, bossIndex, false);
    if (g) return g;
  }
  // safety net (practically unreachable): a single open arena is always connected
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
    u.uid = `${id}#${i}`;        // unit.id may repeat (two wolves) — events carry uid
    u.moveTimer = ENEMY_STEP_MS; // chase step cadence
    return u;
  });
  let bossIndex = units.findIndex((u) => u.boss);
  if (bossIndex < 0 && floorDef.kind === 'boss' && units.length) bossIndex = 0;

  const gen = generateFloor(rng, floorDef, bossIndex);

  const state = {
    cols: gen.cols,
    rows: gen.rows,
    tiles: gen.tiles,
    hero: { x: gen.spawn.x, y: gen.spawn.y, unit: hero },
    enemies: units.map((u, i) => ({ x: gen.enemyPos[i].x, y: gen.enemyPos[i].y, unit: u })),
    result: null,            // null | 'cleared' | 'fallen'
    bossDown: false,
    floorDef,
    time: 0,
  };

  const move = { dx: 0, dy: 0 };
  let heroMoveTimer = 0;

  const emit = (type, data) => { for (const fn of listeners) fn({ type, ...data }); };
  const tileAt = (x, y) =>
    (x >= 0 && y >= 0 && x < state.cols && y < state.rows ? state.tiles[y][x] : TILE.WALL);
  const unitAt = (x, y) => {
    if (state.hero.unit.alive && state.hero.x === x && state.hero.y === y) return state.hero.unit;
    const e = state.enemies.find((en) => en.unit.alive && en.x === x && en.y === y);
    return e ? e.unit : null;
  };
  const isFree = (x, y) => walkableTile(tileAt(x, y)) && !unitAt(x, y); // walls + living units block
  const orthAdjacent = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
  const chebyshev = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

  // living enemies on the 8 tiles around the hero, nearest (orthogonal) first
  const meleeTargets = () =>
    state.enemies
      .filter((e) => e.unit.alive && chebyshev(e, state.hero) === 1)
      .sort((a, b) =>
        ((a.x - state.hero.x) ** 2 + (a.y - state.hero.y) ** 2) -
        ((b.x - state.hero.x) ** 2 + (b.y - state.hero.y) ** 2));

  function kill(unit) {
    unit.alive = false;
    emit('death', { id: unit.uid ?? unit.id });
    if (unit === state.hero.unit) {
      state.result = 'fallen';
      emit('end', { result: 'fallen' });
      return;
    }
    // a caster died mid-cast: resolve as a miss so the host can clear overlays
    if (unit.telegraph) { unit.telegraph = null; emit('telegraphResolve', { hit: false }); }
    if (state.floorDef.kind === 'boss' && state.enemies.every((e) => !e.unit.alive)) {
      state.bossDown = true;
    }
  }

  // mirrors combatSim.applyDamage: armour DR + seeded hit roll
  function applyDamage(src, target, baseDamage) {
    const dr = armorDR(target.armor, src.level);
    const { amount, crit } = rollHit({ baseDamage, critChance: src.critChance ?? 0.05, targetDR: dr }, rng);
    target.hp = Math.max(0, target.hp - amount);
    emit('damage', { sourceId: src.uid ?? src.id, targetId: target.uid ?? target.id, amount, crit });
    if (target.hp === 0 && target.alive) kill(target);
    return amount;
  }

  function gainRage(unit, amt) {
    if (unit.resource?.type === 'rage') {
      unit.resource.value = Math.min(unit.resource.max, unit.resource.value + amt);
    }
  }

  // mirrors combatSim.processPending, with melee (8-neighbour) targeting
  function processPending() {
    while (pending.length) {
      const id = pending.shift();
      const ab = getAbility(id);
      if (!ab || !state.hero.unit.alive) continue;
      const h = state.hero.unit;
      const res = h.resource;
      if (res && res.value < ab.cost) continue;
      if ((h.cooldowns[id] ?? 0) > 0) continue;
      if (res) res.value -= ab.cost;
      h.cooldowns[id] = ab.cooldown;
      const targets = meleeTargets();
      if (ab.kind === 'attack') {
        if (targets[0]) applyDamage(h, targets[0].unit, h.weaponDmg * ab.weaponCoef + h.ap * ab.apCoef);
      } else if (ab.kind === 'aoe') {
        for (const t of targets) applyDamage(h, t.unit, h.weaponDmg * ab.weaponCoef + h.ap * ab.apCoef);
      } else if (ab.kind === 'execute') {
        const t = targets[0];
        if (t) {
          const below = t.unit.hp / t.unit.maxHp <= ab.threshold;
          const coef = below ? ab.weaponCoef : ab.weaponCoef * 0.4;
          applyDamage(h, t.unit, h.weaponDmg * coef + h.ap * ab.apCoef);
        }
      } else if (ab.kind === 'defensive') {
        h.blocking = ab.blockMs;
        h.blockReduce = ab.blockReduce;
      }
      emit('ability', { id, sourceId: h.id });
    }
  }

  // mirrors combatSim.decay
  function decay(unit, dt) {
    for (const k of Object.keys(unit.cooldowns)) {
      unit.cooldowns[k] = Math.max(0, unit.cooldowns[k] - dt);
    }
    if (unit.blocking > 0) unit.blocking = Math.max(0, unit.blocking - dt);
  }

  function tickHeroMove(dt) {
    heroMoveTimer = Math.max(0, heroMoveTimer - dt);
    if (heroMoveTimer > 0 || (!move.dx && !move.dy)) return;
    const h = state.hero;
    const cands = move.dx && move.dy
      ? [[move.dx, move.dy], [move.dx, 0], [0, move.dy]]
      : [[move.dx, move.dy]];
    for (const [mx, my] of cands) {
      if (isFree(h.x + mx, h.y + my)) {
        h.x += mx;
        h.y += my;
        heroMoveTimer = HERO_STEP_MS;
        return;
      }
    }
  }

  function tickHeroAttack(dt) {
    const h = state.hero.unit;
    h.autoAttackTimer -= dt;
    if (h.autoAttackTimer > 0) return;
    const t = state.enemies.find((e) => e.unit.alive && orthAdjacent(e, state.hero));
    if (!t) { h.autoAttackTimer = 0; return; } // stay ready, swing on contact
    h.autoAttackTimer += h.autoAttackEvery;
    applyDamage(h, t.unit, h.weaponDmg + h.ap * 0.3);
    gainRage(h, 10);
  }

  // boss special: mark a 3×3 zone on the hero's current tile, resolve after castMs
  function tickTelegraph(e, dt) {
    const u = e.unit;
    if (!u.ai) return;
    const sp = u.ai.special;
    if (u.telegraph) {
      u.telegraph.remainingMs -= dt;
      if (u.telegraph.remainingMs > 0) return;
      const h = state.hero;
      const hit = u.telegraph.tiles.some((t) => t.x === h.x && t.y === h.y);
      u.telegraph = null;
      u.ai.timer = sp.everyMs;
      if (hit) {
        const dr = armorDR(h.unit.armor, u.level);
        const { amount, crit } = rollHit({ baseDamage: u.weaponDmg * sp.mult, critChance: 0.05, targetDR: dr }, rng);
        const dealt = h.unit.blocking > 0 ? Math.round(amount * 0.5) : amount; // block halves the special
        h.unit.hp = Math.max(0, h.unit.hp - dealt);
        emit('damage', { sourceId: u.uid ?? u.id, targetId: h.unit.id, amount: dealt, crit });
        emit('telegraphResolve', { hit: true });
        if (h.unit.hp === 0 && h.unit.alive) kill(h.unit);
      } else {
        emit('telegraphResolve', { hit: false });
      }
      return;
    }
    u.ai.timer -= dt;
    if (u.ai.timer <= 0) {
      const tiles = [];
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const tx = state.hero.x + ox, ty = state.hero.y + oy;
          if (tileAt(tx, ty) !== TILE.WALL) tiles.push({ x: tx, y: ty });
        }
      }
      u.telegraph = { abilityId: sp.name, remainingMs: sp.castMs, tiles };
      emit('telegraphMark', { tiles, castMs: sp.castMs });
    }
  }

  // mirrors combatSim.checkPhase (Krell enrages below 50%)
  function checkPhase(u) {
    if (u.phase2At && !u.enraged && u.alive && u.hp / u.maxHp <= u.phase2At) {
      u.enraged = true;
      u.autoAttackEvery = Math.round(u.autoAttackEvery * 0.7);
      emit('enrage', { id: u.uid ?? u.id });
    }
  }

  function tickEnemy(e, dt) {
    const u = e.unit;
    tickTelegraph(e, dt);
    if (state.result || !u.alive) return;

    const h = state.hero;
    if (chebyshev(e, h) <= AGGRO_RANGE && !orthAdjacent(e, h)) {
      u.moveTimer -= dt;
      if (u.moveTimer <= 0) {
        u.moveTimer += ENEMY_STEP_MS;
        // greedy step toward the hero, longest axis first; blocked -> other axis
        const dx = Math.sign(h.x - e.x), dy = Math.sign(h.y - e.y);
        const order = Math.abs(h.x - e.x) >= Math.abs(h.y - e.y)
          ? [[dx, 0], [0, dy]]
          : [[0, dy], [dx, 0]];
        for (const [mx, my] of order) {
          if ((mx || my) && isFree(e.x + mx, e.y + my)) { e.x += mx; e.y += my; break; }
        }
      }
    }

    u.autoAttackTimer -= dt;
    if (u.autoAttackTimer <= 0) {
      if (orthAdjacent(e, h) && h.unit.alive) {
        u.autoAttackTimer += u.autoAttackEvery;
        applyDamage(u, h.unit, u.weaponDmg + u.ap * 0.3);
        gainRage(u, 10);
      } else {
        u.autoAttackTimer = 0; // stay ready, swing on contact
      }
    }
    checkPhase(u);
  }

  function tick(dt) {
    processPending();
    if (state.result) return;
    decay(state.hero.unit, dt);
    tickHeroMove(dt);
    tickHeroAttack(dt);
    for (const e of state.enemies) {
      if (state.result) return;
      if (!e.unit.alive) continue;
      tickEnemy(e, dt);
    }
  }

  function step(dt) {
    if (state.result) return;
    let remaining = dt;
    while (remaining > 0 && !state.result) {
      const s = Math.min(SLICE, remaining);
      state.time += s;
      tick(s);
      remaining -= s;
    }
  }

  function setMove(dx, dy) {
    move.dx = dx > 0 ? 1 : dx < 0 ? -1 : 0;
    move.dy = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  }

  // mirrors combatSim.queueAbility validation (cost + cooldown)
  function queueAbility(id) {
    const ab = getAbility(id);
    if (!ab || state.result || !state.hero.unit.alive) return false;
    const res = state.hero.unit.resource;
    if (res && res.value < ab.cost) return false;
    if ((state.hero.unit.cooldowns[id] ?? 0) > 0) return false;
    pending.push(id);
    return true;
  }

  // What interact() WOULD do, without consuming anything. Chest > event > exit;
  // chests/events count on the hero tile + 4-adjacent, the exit only underfoot.
  function peekInteract() {
    if (state.result) return null;
    const { x, y } = state.hero;
    const spots = [[x, y], [x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y]];
    let chest = null, event = null;
    for (const [tx, ty] of spots) {
      const t = tileAt(tx, ty);
      if (t === TILE.CHEST && !chest) chest = { type: 'chest', x: tx, y: ty };
      else if (t === TILE.EVENT && !event) event = { type: 'event', x: tx, y: ty };
    }
    if (chest) return chest;
    if (event) return event;
    if (tileAt(x, y) === TILE.EXIT && (state.floorDef.kind !== 'boss' || state.bossDown)) {
      return { type: 'exit' };
    }
    return null;
  }

  function interact() {
    const found = peekInteract();
    if (!found) return null;
    if (found.type === 'chest') {
      state.tiles[found.y][found.x] = TILE.CHEST_OPEN;
      emit('loot', {});
      return { type: 'chest' };
    }
    if (found.type === 'event') {
      state.tiles[found.y][found.x] = TILE.FLOOR; // consumed — host rolls the encounter
      return { type: 'event' };
    }
    state.result = 'cleared';
    emit('end', { result: 'cleared' });
    return { type: 'exit' };
  }

  return {
    state,
    step,
    setMove,
    queueAbility,
    interact,
    peekInteract,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
