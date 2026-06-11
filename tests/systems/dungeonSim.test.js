import { describe, it, expect } from 'vitest';
import { createDungeon, TILE, isReachable } from '../../src/systems/dungeonSim.js';
import { createHero } from '../../src/systems/hero.js';

const FLOOR_1 = { kind: 'normal', enemies: ['waldwolf'], chests: 1, events: 1 };
const dungeon = (seed = 1, floorDef = FLOOR_1) =>
  createDungeon({ hero: createHero('krieger'), floorDef, seed });

function findTiles(state, code) {
  const out = [];
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      if (state.tiles[y][x] === code) out.push({ x, y });
    }
  }
  return out;
}

describe('floor generation', () => {
  it('keeps a solid wall border and is fully connected (exit, chests, events, enemies)', () => {
    for (const seed of [1, 7, 42, 99, 1234]) {
      const d = dungeon(seed);
      const s = d.state;
      for (let x = 0; x < s.cols; x++) {
        expect(s.tiles[0][x]).toBe(TILE.WALL);
        expect(s.tiles[s.rows - 1][x]).toBe(TILE.WALL);
      }
      for (let y = 0; y < s.rows; y++) {
        expect(s.tiles[y][0]).toBe(TILE.WALL);
        expect(s.tiles[y][s.cols - 1]).toBe(TILE.WALL);
      }
      const spawn = { x: s.hero.x, y: s.hero.y };
      const exits = findTiles(s, TILE.EXIT);
      expect(exits.length).toBe(1);
      expect(isReachable(s.tiles, spawn, exits[0])).toBe(true);
      for (const c of findTiles(s, TILE.CHEST)) expect(isReachable(s.tiles, spawn, c)).toBe(true);
      for (const e of findTiles(s, TILE.EVENT)) expect(isReachable(s.tiles, spawn, e)).toBe(true);
      for (const en of s.enemies) expect(isReachable(s.tiles, spawn, en)).toBe(true);
      expect(findTiles(s, TILE.CHEST).length).toBe(1);
      expect(findTiles(s, TILE.EVENT).length).toBe(1);
    }
  });
});

describe('movement', () => {
  it('setMove walks the hero one tile per step interval; walls block', () => {
    const d = dungeon(3, { kind: 'boss', enemies: [], chests: 0, events: 0 }); // open arena, no enemies
    const h = d.state.hero;
    const x0 = h.x;
    d.setMove(1, 0);
    d.step(160);
    expect(h.x).toBe(x0 + 1);
    // run into the east wall: position must clamp before the border
    d.step(160 * 40);
    expect(h.x).toBeLessThan(d.state.cols - 1);
    d.setMove(0, 0);
    const xStop = h.x;
    d.step(1000);
    expect(h.x).toBe(xStop); // released joystick -> no drift
  });
});

describe('enemy AI', () => {
  it('an aggroed enemy closes distance and damages the adjacent hero', () => {
    const d = dungeon(5, { kind: 'boss', enemies: ['waldwolf'], chests: 0, events: 0 });
    const h = d.state.hero;
    const e = d.state.enemies[0];
    const dist0 = Math.max(Math.abs(e.x - h.x), Math.abs(e.y - h.y));
    let dmgToHero = 0;
    d.on((ev) => { if (ev.type === 'damage' && ev.targetId === 'hero') dmgToHero += ev.amount; });
    d.step(10_000);
    const dist1 = Math.max(Math.abs(e.x - h.x), Math.abs(e.y - h.y));
    expect(dist1).toBeLessThanOrEqual(Math.max(1, dist0)); // closed in (or already dead by hero autos)
    if (e.unit.alive) expect(dist1).toBeLessThanOrEqual(1 + 1); // adjacent-ish
    expect(dmgToHero).toBeGreaterThan(0);
  });
});

describe('abilities (melee semantics)', () => {
  it('heroic_strike with rage damages an adjacent enemy', () => {
    const d = dungeon(5, { kind: 'boss', enemies: ['waldwolf'], chests: 0, events: 0 });
    const h = d.state.hero;
    const e = d.state.enemies[0];
    // teleport enemy next to hero (test setup), give rage
    e.x = h.x + 1; e.y = h.y;
    h.unit.resource.value = 100;
    const hp0 = e.unit.hp;
    expect(d.queueAbility('heroic_strike')).toBe(true);
    d.step(50);
    expect(e.unit.hp).toBeLessThan(hp0);
    expect(h.unit.resource.value).toBe(85);
  });
  it('rejects without rage or on cooldown', () => {
    const d = dungeon(5);
    d.state.hero.unit.resource.value = 5;
    expect(d.queueAbility('heroic_strike')).toBe(false);
    d.state.hero.unit.resource.value = 100;
    expect(d.queueAbility('whirlwind')).toBe(true);
    d.step(50);
    expect(d.queueAbility('whirlwind')).toBe(false); // 6s cd
  });
});

describe('interaction', () => {
  it('chest: peek sees it, interact opens it (tile -> CHEST_OPEN) and emits loot', () => {
    const d = dungeon(11);
    const s = d.state;
    const chest = findTiles(s, TILE.CHEST)[0];
    s.hero.x = chest.x; s.hero.y = chest.y - 1 >= 0 && s.tiles[chest.y - 1][chest.x] !== TILE.WALL ? chest.y - 1 : chest.y + 1;
    // ensure adjacency regardless of layout: place hero orthogonally next to the chest
    s.hero.x = chest.x; s.hero.y = chest.y; // standing "on" is not possible (solid), so use side:
    s.hero.y = chest.y; s.hero.x = chest.x - 1;
    let loot = 0;
    d.on((ev) => { if (ev.type === 'loot') loot++; });
    expect(d.peekInteract()?.type).toBe('chest');
    expect(d.interact()).toEqual({ type: 'chest' });
    expect(s.tiles[chest.y][chest.x]).toBe(TILE.CHEST_OPEN);
    expect(loot).toBe(1);
    expect(d.peekInteract()?.type ?? null).not.toBe('chest'); // consumed
  });

  it('event: interact consumes the tile and reports type event', () => {
    const d = dungeon(11);
    const s = d.state;
    const ev = findTiles(s, TILE.EVENT)[0];
    s.hero.x = ev.x - 1; s.hero.y = ev.y;
    expect(d.interact()).toEqual({ type: 'event' });
    expect(s.tiles[ev.y][ev.x]).toBe(TILE.FLOOR);
  });

  it('normal floor: standing on the exit clears the floor', () => {
    const d = dungeon(13);
    const s = d.state;
    const exit = findTiles(s, TILE.EXIT)[0];
    s.hero.x = exit.x; s.hero.y = exit.y;
    let ended = null;
    d.on((e) => { if (e.type === 'end') ended = e.result; });
    expect(d.interact()).toEqual({ type: 'exit' });
    expect(s.result).toBe('cleared');
    expect(ended).toBe('cleared');
  });

  it('boss floor: exit refuses while the boss lives, works after bossDown', () => {
    const d = dungeon(17, { kind: 'boss', enemies: ['krell'], chests: 0, events: 0 });
    const s = d.state;
    const exit = findTiles(s, TILE.EXIT)[0];
    s.hero.x = exit.x; s.hero.y = exit.y;
    expect(d.peekInteract()).toBeNull();
    expect(d.interact()).toBeNull();
    s.enemies[0].unit.hp = 0; s.enemies[0].unit.alive = false; s.bossDown = true;
    expect(d.interact()).toEqual({ type: 'exit' });
    expect(s.result).toBe('cleared');
  });
});

describe('boss telegraph (dodge by moving!)', () => {
  function runUntilTelegraph(d, dodge) {
    let marked = null, resolved = null;
    d.on((e) => {
      if (e.type === 'telegraphMark' && !marked) {
        marked = e;
        if (dodge) {
          // teleport hero far out of the zone (simulates running out)
          const s = d.state;
          outer: for (let y = 1; y < s.rows - 1; y++) {
            for (let x = 1; x < s.cols - 1; x++) {
              const inZone = e.tiles.some((t) => t.x === x && t.y === y);
              const free = s.tiles[y][x] === TILE.FLOOR;
              if (!inZone && free) { s.hero.x = x; s.hero.y = y; break outer; }
            }
          }
        }
      }
      if (e.type === 'telegraphResolve' && resolved === null) resolved = e.hit;
    });
    for (let i = 0; i < 400 && resolved === null && !d.state.result; i++) d.step(50);
    return resolved;
  }

  it('staying in the zone -> hit:true and hp drops; moving out -> hit:false', () => {
    const dStay = dungeon(21, { kind: 'boss', enemies: ['krell'], chests: 0, events: 0 });
    // keep hero out of melee chaos for a clean reading: park him, no inputs
    const hp0 = dStay.state.hero.unit.maxHp;
    const hitStay = runUntilTelegraph(dStay, false);
    expect(hitStay).toBe(true);
    expect(dStay.state.hero.unit.hp).toBeLessThan(hp0);

    const dDodge = dungeon(21, { kind: 'boss', enemies: ['krell'], chests: 0, events: 0 });
    const hitDodge = runUntilTelegraph(dDodge, true);
    expect(hitDodge).toBe(false);
  });
});

describe('determinism', () => {
  it('same seed + same inputs => identical positions and hp', () => {
    const a = dungeon(31, { kind: 'normal', enemies: ['waldwolf', 'keiler'], chests: 1, events: 0 });
    const b = dungeon(31, { kind: 'normal', enemies: ['waldwolf', 'keiler'], chests: 1, events: 0 });
    const script = [[1, 0], [1, 0], [0, 1], [0, 0], [1, 0]];
    for (const [dx, dy] of script) {
      a.setMove(dx, dy); b.setMove(dx, dy);
      a.step(500); b.step(500);
    }
    expect(a.state.hero.x).toBe(b.state.hero.x);
    expect(a.state.hero.y).toBe(b.state.hero.y);
    expect(a.state.enemies.map((e) => [e.x, e.y, Math.round(e.unit.hp)]))
      .toEqual(b.state.enemies.map((e) => [e.x, e.y, Math.round(e.unit.hp)]));
  });
});
