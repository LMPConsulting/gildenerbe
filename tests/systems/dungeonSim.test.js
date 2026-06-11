import { describe, it, expect } from 'vitest';
import { createDungeon, TILE, isReachable } from '../../src/systems/dungeonSim.js';
import { createHero } from '../../src/systems/hero.js';

const arena = (enemies = []) => ({ kind: 'boss', enemies, chests: 0, events: 0 });
function find(state, code) {
  const out = [];
  for (let y = 0; y < state.rows; y++) for (let x = 0; x < state.cols; x++) if (state.tiles[y][x] === code) out.push({ x, y });
  return out;
}

describe('generation', () => {
  it('walls the border and stays connected (exit/chests/events/enemies reachable)', () => {
    for (const seed of [1, 5, 42, 1234]) {
      const d = createDungeon({ hero: createHero('krieger'), floorDef: { kind: 'normal', enemies: ['waldwolf', 'keiler'], chests: 1, events: 1 }, seed });
      const s = d.state;
      for (let x = 0; x < s.cols; x++) { expect(s.tiles[0][x]).toBe(TILE.WALL); expect(s.tiles[s.rows - 1][x]).toBe(TILE.WALL); }
      const spawn = { x: s.hero.x, y: s.hero.y };
      expect(isReachable(s.tiles, spawn, find(s, TILE.EXIT)[0])).toBe(true);
      for (const c of find(s, TILE.CHEST)) expect(isReachable(s.tiles, spawn, c)).toBe(true);
      for (const e of s.enemies) expect(isReachable(s.tiles, spawn, e)).toBe(true);
    }
  });
});

describe('continuous movement', () => {
  it('moves smoothly (not tile-locked) and walls block', () => {
    const d = createDungeon({ hero: createHero('krieger'), floorDef: arena(), seed: 3 });
    const h = d.state.hero;
    const x0 = h.x;
    d.setMove(1, 0); d.step(100);
    const moved = h.x - x0;
    expect(moved).toBeGreaterThan(0);
    expect(moved).not.toBeCloseTo(1, 5); // a fraction of a tile, not a whole step
    d.step(100000); // shove into the east wall for a long time
    expect(h.x).toBeLessThan(d.state.cols - 1);
    // never ended up inside a solid tile
    expect([TILE.WALL, TILE.PILLAR]).not.toContain(d.state.tiles[h.y | 0][h.x | 0]);
  });
  it('faces the movement direction', () => {
    const d = createDungeon({ hero: createHero('krieger'), floorDef: arena(), seed: 3 });
    d.setMove(1, 0); d.step(40);
    expect(Math.abs(d.state.hero.angle)).toBeLessThan(0.2); // ~0 = east
    d.setMove(0, -1); d.step(40);
    expect(d.state.hero.angle).toBeCloseTo(-Math.PI / 2, 1); // north
  });
});

describe('melee arc', () => {
  function meleeCase(dx) {
    const d = createDungeon({ hero: createHero('krieger'), floorDef: arena(['waldwolf']), seed: 7 });
    d.state.hero.angle = 0; // facing east
    d.state.hero.unit.resource.value = 100;
    const e = d.state.enemies[0];
    e.x = d.state.hero.x + dx; e.y = d.state.hero.y; // dx=+1 front, -1 behind
    const hp0 = e.unit.hp;
    d.queueAbility('heroic_strike'); d.step(40);
    return hp0 - e.unit.hp;
  }
  it('hits an enemy in the facing arc', () => { expect(meleeCase(1)).toBeGreaterThan(0); });
  it('misses an enemy behind the hero', () => { expect(meleeCase(-1)).toBe(0); });
  it('whirlwind hits all around (even behind)', () => {
    const d = createDungeon({ hero: createHero('krieger'), floorDef: arena(['waldwolf']), seed: 7 });
    d.state.hero.angle = 0; d.state.hero.unit.resource.value = 100;
    const e = d.state.enemies[0]; e.x = d.state.hero.x - 1; e.y = d.state.hero.y;
    const hp0 = e.unit.hp;
    d.queueAbility('whirlwind'); d.step(40);
    expect(e.unit.hp).toBeLessThan(hp0);
  });
});

describe('ranged hero (mage projectiles)', () => {
  it('frostbolt flies and hits a distant enemy', () => {
    const d = createDungeon({ hero: createHero('magier'), floorDef: arena(['waldwolf']), seed: 9 });
    const e = d.state.enemies[0];
    e.x = d.state.hero.x + 3; e.y = d.state.hero.y;
    const hp0 = e.unit.hp;
    expect(d.queueAbility('frostbolt')).toBe(true);
    d.step(700);
    expect(e.unit.hp).toBeLessThan(hp0);
  });
});

describe('enemy behaviours', () => {
  it('a chaser closes the gap and bites the hero', () => {
    const d = createDungeon({ hero: createHero('krieger'), floorDef: arena(['waldwolf']), seed: 11 });
    const h = d.state.hero, e = d.state.enemies[0];
    e.x = h.x + 4; e.y = h.y;
    const d0 = Math.hypot(e.x - h.x, e.y - h.y);
    d.step(5000);
    const d1 = Math.hypot(e.x - h.x, e.y - h.y);
    expect(d1).toBeLessThan(d0);
    expect(h.unit.hp < h.unit.maxHp || !e.unit.alive).toBe(true);
  });
  it('a ranged enemy shoots a stationary hero from afar', () => {
    const d = createDungeon({ hero: createHero('krieger'), floorDef: arena(['bogenschuetze']), seed: 13 });
    const h = d.state.hero, e = d.state.enemies[0];
    e.x = h.x + 5; e.y = h.y;
    d.step(6000); // hero never moves -> archer kites + shoots
    expect(h.unit.hp).toBeLessThan(h.unit.maxHp);
  });
});

describe('boss ground telegraph (dodge by walking out)', () => {
  function run(dodge) {
    const d = createDungeon({ hero: createHero('krieger'), floorDef: arena(['krell']), seed: 17 });
    let mark = null, hit = null;
    d.on((ev) => {
      if (ev.type === 'telegraphMark' && !mark) {
        mark = ev;
        if (dodge) { d.state.hero.x = ev.x + 4; d.state.hero.y = ev.y; } // teleport clear
      }
      if (ev.type === 'telegraphResolve' && hit === null) hit = ev.hit;
    });
    for (let i = 0; i < 400 && hit === null && !d.state.result; i++) d.step(50);
    return { hit, d };
  }
  it('staying inside the zone gets hit; walking out avoids it', () => {
    expect(run(false).hit).toBe(true);
    expect(run(true).hit).toBe(false);
  });
});

describe('interaction', () => {
  it('opens an adjacent chest (emits loot, tile -> opened)', () => {
    const d = createDungeon({ hero: createHero('krieger'), floorDef: { kind: 'normal', enemies: [], chests: 1, events: 0 }, seed: 21 });
    const c = find(d.state, TILE.CHEST)[0];
    d.state.hero.x = c.x + 0.5; d.state.hero.y = c.y + 0.5 - 0.8;
    let loot = 0; d.on((e) => { if (e.type === 'loot') loot++; });
    expect(d.peekInteract()?.type).toBe('chest');
    expect(d.interact()).toEqual({ type: 'chest' });
    expect(d.state.tiles[c.y][c.x]).toBe(TILE.CHEST_OPEN);
    expect(loot).toBe(1);
  });
  it('standing on the exit clears a normal floor', () => {
    const d = createDungeon({ hero: createHero('krieger'), floorDef: { kind: 'normal', enemies: [], chests: 0, events: 0 }, seed: 23 });
    const ex = find(d.state, TILE.EXIT)[0];
    d.state.hero.x = ex.x + 0.5; d.state.hero.y = ex.y + 0.5;
    expect(d.interact()).toEqual({ type: 'exit' });
    expect(d.state.result).toBe('cleared');
  });
  it('the boss-floor exit is gated until the boss dies', () => {
    const d = createDungeon({ hero: createHero('krieger'), floorDef: { kind: 'boss', enemies: ['krell'], chests: 0, events: 0 }, seed: 27 });
    const ex = find(d.state, TILE.EXIT)[0];
    d.state.hero.x = ex.x + 0.5; d.state.hero.y = ex.y + 0.5;
    expect(d.peekInteract()).toBeNull();
    d.state.enemies[0].unit.hp = 0; d.state.enemies[0].unit.alive = false; d.state.bossDown = true;
    expect(d.interact()).toEqual({ type: 'exit' });
    expect(d.state.result).toBe('cleared');
  });
});

describe('determinism', () => {
  it('same seed + same inputs => identical positions and hp', () => {
    const make = () => createDungeon({ hero: createHero('krieger'), floorDef: { kind: 'normal', enemies: ['waldwolf', 'keiler'], chests: 1, events: 0 }, seed: 31 });
    const a = make(), b = make();
    for (const [dx, dy] of [[1, 0], [1, 1], [0, 1], [-1, 0], [0, 0]]) {
      a.setMove(dx, dy); b.setMove(dx, dy); a.step(400); b.step(400);
    }
    expect([a.state.hero.x, a.state.hero.y]).toEqual([b.state.hero.x, b.state.hero.y]);
    expect(a.state.enemies.map((e) => [e.x, e.y, Math.round(e.unit.hp)]))
      .toEqual(b.state.enemies.map((e) => [e.x, e.y, Math.round(e.unit.hp)]));
  });
});
