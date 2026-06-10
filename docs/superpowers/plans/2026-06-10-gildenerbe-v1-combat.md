# Gildenerbe v1 — Plan 2: Kampf-Kern (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A playable combat slice: a fixed starting Krieger fights through Zone 1 (Eichhain) — trash, an elite, and the boss — using real abilities, rage, cooldowns, and a telegraph/block reflex moment, all on a deterministic, unit-tested simulation rendered by a touch combat screen.

**Architecture:** A **pure, deterministic `CombatSim`** holds all fight state and is stepped by `dt` ms; every random outcome comes from an injected seeded RNG, so fights are fully reproducible and unit-testable. The UI layer (`combatScreen`) only *renders* sim state and *forwards* player ability taps — it owns no game logic. Pure helper modules (`stats`, `damage`) compute numbers; `data/*` holds abilities/enemies/zone as plain config. A `run` controller sequences Zone-1 encounters and start/win/lose flow. Leveling, talents, and loot are explicitly **out of scope** (Plan 3); Erbe/reroll/offline are Plan 5.

**Tech Stack:** vanilla ES modules, Vitest (node env), Canvas 2D for the combat scene + sprites, DOM for bars/buttons/overlays.

**Plan-format note:** Pure-logic tasks (1–6) include full test + implementation code. The `CombatSim` (Task 7) is large and iterative, so it is specified by its **state shape, public API, event list, and a full battery of test scenarios** (the tests ARE the spec); its body is implemented test-by-test during execution. UI/run tasks (8–10) are behaviour-specified and verified live in the browser preview (`gildenerbe-dev`, port 5173) with screenshots.

---

## File Structure (locked)

```
src/
  data/
    abilities.js     # Krieger ability definitions (data + integrity-tested)
    enemies.js       # Zone-1 enemy + boss definitions
    zones.js         # Zone 1 "Eichhain" = ordered encounter list
  systems/
    stats.js         # computeDerived(primary, level, weapon), armorDR()  [pure]
    damage.js        # rollHit(params, rng) -> { amount, crit }            [pure]
    hero.js          # createHero(classId) -> starting Krieger unit
    combatSim.js     # createCombat({hero,enemies,seed}); deterministic engine
  ui/
    sprites.js       # functional pixel sprites drawn to canvas (polished in Plan 6)
    combatScreen.js  # render a CombatSim + wire ability buttons / telegraph block
  run.js             # run controller: hero + Zone-1 progression, start/next/end
tests/
  systems/{stats,damage,hero,combatSim}.test.js
  data/{abilities,enemies}.test.js
```

Sim core (`stats`, `damage`, `combatSim`, `hero`, `data/*`) imports nothing from `ui/`. UI imports sim, never the reverse.

---

## Shared definitions (used across tasks)

**Unit shape** (hero and enemies share it):
```
{
  id, name, side: 'hero' | 'enemy', level,
  maxHp, hp, armor,
  ap, weaponDmg, critChance,            // offense
  resource: { type: 'rage', value: 0, max: 100 } | null,
  abilities: [abilityId, ...],          // ids into data/abilities or enemy.specials
  cooldowns: {},                        // abilityId -> ms remaining
  autoAttackEvery: 2000, autoAttackTimer: 2000,
  // enemy AI only:
  ai: { specialEvery, specialTimer, specialId } | null,
  telegraph: null,                      // { abilityId, castMs, remainingMs, incoming }
  blocking: 0,                          // ms of active block remaining (hero)
  alive: true,
}
```

**Ability shape** (`data/abilities.js`):
```
{ id, name, kind: 'attack'|'aoe'|'defensive'|'execute', cost, cooldown,
  weaponCoef, apCoef, note }
```

**CombatSim events** (emitted via a callback the UI subscribes to):
`damage {sourceId,targetId,amount,crit}`, `death {id}`, `ability {id,sourceId}`,
`telegraphStart {sourceId,abilityId,castMs}`, `telegraphResolve {sourceId,abilityId,blocked}`,
`end {result:'won'|'lost'}`.

---

## Task 1: Stats module (`src/systems/stats.js`)

**Files:** Create `src/systems/stats.js`, Test `tests/systems/stats.test.js`

- [ ] **Step 1: Write the failing test**
```js
// tests/systems/stats.test.js
import { describe, it, expect } from 'vitest';
import { computeDerived, armorDR } from '../../src/systems/stats.js';

describe('computeDerived', () => {
  it('HP = 50 + level*10 + STA*10', () => {
    const d = computeDerived({ str: 10, agi: 5, int: 1, sta: 8 }, 5, { dmg: 12, bonusAp: 0 });
    expect(d.maxHp).toBe(50 + 5 * 10 + 8 * 10); // 180
  });
  it('AP = STR*2 + weapon bonus, weaponDmg from weapon', () => {
    const d = computeDerived({ str: 10, agi: 0, int: 0, sta: 0 }, 1, { dmg: 12, bonusAp: 4 });
    expect(d.ap).toBe(24);        // 10*2 + 4
    expect(d.weaponDmg).toBe(12);
  });
  it('crit = 0.05 base + AGI*0.0005', () => {
    const d = computeDerived({ str: 0, agi: 100, int: 0, sta: 0 }, 1, { dmg: 1, bonusAp: 0 });
    expect(d.critChance).toBeCloseTo(0.05 + 100 * 0.0005); // 0.10
  });
});

describe('armorDR', () => {
  it('follows armor/(armor + 50*level + 400) and is in [0,0.75]', () => {
    expect(armorDR(0, 5)).toBe(0);
    expect(armorDR(200, 5)).toBeCloseTo(200 / (200 + 250 + 400)); // ~0.235
    expect(armorDR(1e9, 5)).toBe(0.75); // capped
  });
});
```
- [ ] **Step 2: Run → FAIL** `npx vitest run tests/systems/stats.test.js` (computeDerived not defined)
- [ ] **Step 3: Implement**
```js
// src/systems/stats.js
export function computeDerived(primary, level, weapon) {
  const { str = 0, agi = 0, sta = 0 } = primary;
  return {
    maxHp: 50 + level * 10 + sta * 10,
    ap: str * 2 + (weapon?.bonusAp ?? 0),
    weaponDmg: weapon?.dmg ?? 0,
    critChance: 0.05 + agi * 0.0005,
  };
}

export function armorDR(armor, attackerLevel) {
  const dr = armor / (armor + 50 * attackerLevel + 400);
  return Math.min(0.75, Math.max(0, dr));
}
```
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** `feat(combat): derived stats + armor damage-reduction`

---

## Task 2: Damage module (`src/systems/damage.js`)

**Files:** Create `src/systems/damage.js`, Test `tests/systems/damage.test.js`

- [ ] **Step 1: Write the failing test**
```js
// tests/systems/damage.test.js
import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/core/rng.js';
import { rollHit } from '../../src/systems/damage.js';

const base = { baseDamage: 100, critChance: 0, critMult: 2, targetDR: 0 };

describe('rollHit', () => {
  it('non-crit damage stays within ±10% variance of base', () => {
    const rng = makeRng(1);
    for (let i = 0; i < 50; i++) {
      const { amount, crit } = rollHit(base, rng);
      expect(crit).toBe(false);
      expect(amount).toBeGreaterThanOrEqual(90);
      expect(amount).toBeLessThanOrEqual(110);
    }
  });
  it('critChance 1 always crits and doubles (before variance)', () => {
    const rng = makeRng(2);
    const { amount, crit } = rollHit({ ...base, critChance: 1 }, rng);
    expect(crit).toBe(true);
    expect(amount).toBeGreaterThanOrEqual(180); // 200 * 0.9
    expect(amount).toBeLessThanOrEqual(220);
  });
  it('targetDR reduces damage', () => {
    const rng = makeRng(3);
    const { amount } = rollHit({ ...base, targetDR: 0.5 }, rng);
    expect(amount).toBeLessThanOrEqual(55); // ~50 ±10%
  });
  it('is deterministic for a given seed', () => {
    expect(rollHit(base, makeRng(9)).amount).toBe(rollHit(base, makeRng(9)).amount);
  });
});
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement**
```js
// src/systems/damage.js
export function rollHit({ baseDamage, critChance, critMult = 2, targetDR = 0 }, rng) {
  const crit = rng.chance(critChance);
  const variance = rng.float(0.9, 1.1);
  const amount = Math.round(baseDamage * (crit ? critMult : 1) * (1 - targetDR) * variance);
  return { amount, crit };
}
```
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** `feat(combat): seeded damage roll (crit, variance, DR)`

---

## Task 3: Krieger ability data (`src/data/abilities.js`)

**Files:** Create `src/data/abilities.js`, Test `tests/data/abilities.test.js`

- [ ] **Step 1: Write the failing test**
```js
// tests/data/abilities.test.js
import { describe, it, expect } from 'vitest';
import { ABILITIES, getAbility } from '../../src/data/abilities.js';

describe('ABILITIES', () => {
  it('every ability has unique id and required numeric fields', () => {
    const ids = new Set();
    for (const a of Object.values(ABILITIES)) {
      expect(ids.has(a.id)).toBe(false); ids.add(a.id);
      expect(typeof a.cost).toBe('number');
      expect(typeof a.cooldown).toBe('number');
      expect(['attack', 'aoe', 'defensive', 'execute']).toContain(a.kind);
    }
  });
  it('includes the core Krieger kit', () => {
    for (const id of ['heroic_strike', 'whirlwind', 'shield_block', 'execute']) {
      expect(getAbility(id)).toBeTruthy();
    }
  });
  it('getAbility returns undefined for unknown id', () => {
    expect(getAbility('nope')).toBeUndefined();
  });
});
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement**
```js
// src/data/abilities.js
export const ABILITIES = {
  heroic_strike: { id: 'heroic_strike', name: 'Heldenhafter Stoß', kind: 'attack',
    cost: 15, cooldown: 0,    weaponCoef: 1.2, apCoef: 0.1, note: '120% Waffenschaden' },
  whirlwind:     { id: 'whirlwind',     name: 'Wirbelwind',       kind: 'aoe',
    cost: 25, cooldown: 6000, weaponCoef: 0.8, apCoef: 0.1, note: '80% an alle' },
  shield_block:  { id: 'shield_block',  name: 'Schildblock',      kind: 'defensive',
    cost: 10, cooldown: 12000, blockMs: 4000, blockReduce: 0.6, note: 'mildert nächsten Treffer' },
  execute:       { id: 'execute',       name: 'Hinrichten',       kind: 'execute',
    cost: 25, cooldown: 8000, weaponCoef: 2.5, apCoef: 0.2, threshold: 0.2, note: 'Finisher <20%' },
};
export const getAbility = (id) => ABILITIES[id];
```
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** `feat(combat): Krieger ability data`

---

## Task 4: Zone-1 enemy data (`src/data/enemies.js`)

**Files:** Create `src/data/enemies.js`, Test `tests/data/enemies.test.js`

- [ ] **Step 1: Write the failing test**
```js
// tests/data/enemies.test.js
import { describe, it, expect } from 'vitest';
import { ENEMIES, makeEnemy } from '../../src/data/enemies.js';

describe('ENEMIES', () => {
  it('each enemy has positive hp/dmg/level and a sprite key', () => {
    for (const e of Object.values(ENEMIES)) {
      expect(e.hp).toBeGreaterThan(0);
      expect(e.dmg).toBeGreaterThan(0);
      expect(e.level).toBeGreaterThan(0);
      expect(typeof e.sprite).toBe('string');
    }
  });
  it('the boss Krell has a special telegraph ability and phase-2 threshold', () => {
    const krell = ENEMIES.krell;
    expect(krell.special).toBeTruthy();
    expect(krell.special.castMs).toBeGreaterThan(0);
    expect(krell.phase2At).toBeGreaterThan(0);
  });
  it('makeEnemy returns a fresh combat unit with full hp', () => {
    const u = makeEnemy('waldwolf');
    expect(u.side).toBe('enemy');
    expect(u.hp).toBe(u.maxHp);
    const u2 = makeEnemy('waldwolf');
    u.hp = 1;
    expect(u2.hp).toBe(u2.maxHp); // independent instances
  });
});
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement**
```js
// src/data/enemies.js
// Stats illustrative per spec §7; tuned later. dmg = per auto-attack hit.
export const ENEMIES = {
  waldwolf: { id: 'waldwolf', name: 'Waldwolf', level: 2, hp: 45, dmg: 8, armor: 20,
    xp: 12, copper: [2, 5], sprite: 'wolf' },
  raeuber:  { id: 'raeuber',  name: 'Räuber',   level: 3, hp: 70, dmg: 12, armor: 40,
    xp: 20, copper: [5, 12], sprite: 'bandit' },
  keiler:   { id: 'keiler',   name: 'Keiler',   level: 2, hp: 60, dmg: 9, armor: 25,
    xp: 15, copper: [3, 7], sprite: 'boar' },
  rudelfuehrer: { id: 'rudelfuehrer', name: 'Rudelführer', level: 4, hp: 200, dmg: 18,
    armor: 60, xp: 60, copper: [15, 30], sprite: 'wolf_elite', elite: true },
  krell: { id: 'krell', name: 'Banditenhauptmann Krell', level: 5, hp: 800, dmg: 25,
    armor: 200, xp: 200, copper: [80, 140], sprite: 'krell', boss: true,
    phase2At: 0.5, // enrage at 50% hp
    special: { name: 'Wuchtiger Hieb', castMs: 2000, mult: 2.4, everyMs: 9000 } },
};

export function makeEnemy(id) {
  const e = ENEMIES[id];
  return {
    id: e.id, name: e.name, side: 'enemy', level: e.level,
    maxHp: e.hp, hp: e.hp, armor: e.armor, ap: 0, weaponDmg: e.dmg,
    critChance: 0.05, resource: null, abilities: [], cooldowns: {},
    autoAttackEvery: 2000, autoAttackTimer: 2000,
    ai: e.special ? { everyMs: e.special.everyMs, timer: e.special.everyMs, special: e.special } : null,
    telegraph: null, blocking: 0, alive: true,
    enraged: false, phase2At: e.phase2At ?? null,
    xp: e.xp, copper: e.copper, sprite: e.sprite, boss: !!e.boss, elite: !!e.elite,
  };
}
```
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** `feat(combat): Zone-1 enemy + boss data`

---

## Task 5: Hero factory (`src/systems/hero.js`)

**Files:** Create `src/systems/hero.js`, Test `tests/systems/hero.test.js`

- [ ] **Step 1: Write the failing test**
```js
// tests/systems/hero.test.js
import { describe, it, expect } from 'vitest';
import { createHero } from '../../src/systems/hero.js';

describe('createHero', () => {
  it('creates a level-1 Krieger with full hp, rage resource and a weapon', () => {
    const h = createHero('krieger');
    expect(h.side).toBe('hero');
    expect(h.level).toBe(1);
    expect(h.hp).toBe(h.maxHp);
    expect(h.resource.type).toBe('rage');
    expect(h.weaponDmg).toBeGreaterThan(0);
    expect(h.abilities).toContain('heroic_strike');
  });
  it('throws on unknown class', () => {
    expect(() => createHero('wizardd')).toThrow();
  });
});
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement**
```js
// src/systems/hero.js
import { computeDerived } from './stats.js';

const CLASSES = {
  krieger: {
    name: 'Krieger', primary: { str: 12, agi: 6, int: 3, sta: 10 },
    weapon: { name: 'Abgenutztes Schwert', dmg: 10, bonusAp: 0 },
    abilities: ['heroic_strike', 'whirlwind', 'shield_block', 'execute'],
  },
};

export function createHero(classId) {
  const c = CLASSES[classId];
  if (!c) throw new Error(`Unbekannte Klasse: ${classId}`);
  const d = computeDerived(c.primary, 1, c.weapon);
  return {
    id: 'hero', name: c.name, side: 'hero', classId, level: 1,
    maxHp: d.maxHp, hp: d.maxHp, armor: 30, ap: d.ap, weaponDmg: d.weaponDmg,
    critChance: d.critChance,
    resource: { type: 'rage', value: 0, max: 100 },
    abilities: [...c.abilities], cooldowns: {},
    autoAttackEvery: 2000, autoAttackTimer: 2000,
    ai: null, telegraph: null, blocking: 0, alive: true,
    weapon: c.weapon, primary: c.primary,
  };
}
```
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** `feat(combat): Krieger hero factory`

---

## Task 6: CombatSim — scaffolding + auto-attack loop

This task creates `combatSim.js` with state + `step()` doing only **auto-attacks**, plus the event sink. Abilities, enemy specials, and win/lose land in Task 7.

**Files:** Create `src/systems/combatSim.js`, Test `tests/systems/combatSim.test.js`

- [ ] **Step 1: Write the failing test**
```js
// tests/systems/combatSim.test.js
import { describe, it, expect } from 'vitest';
import { createCombat } from '../../src/systems/combatSim.js';
import { createHero } from '../../src/systems/hero.js';
import { makeEnemy } from '../../src/data/enemies.js';

function fight(seed = 1, enemyIds = ['waldwolf']) {
  return createCombat({ hero: createHero('krieger'), enemies: enemyIds.map(makeEnemy), seed });
}

describe('CombatSim auto-attacks', () => {
  it('hero auto-attack lowers enemy hp over time and builds rage', () => {
    const c = fight();
    const enemy = c.state.enemies[0];
    const hpBefore = enemy.hp;
    c.step(2000); // one hero swing due
    expect(enemy.hp).toBeLessThan(hpBefore);
    expect(c.state.hero.resource.value).toBeGreaterThan(0);
  });
  it('is deterministic: same seed + same steps => identical enemy hp', () => {
    const a = fight(7); const b = fight(7);
    for (let i = 0; i < 5; i++) { a.step(500); b.step(500); }
    expect(a.state.enemies[0].hp).toBe(b.state.enemies[0].hp);
  });
  it('emits damage events through the subscriber', () => {
    const c = fight();
    const events = [];
    c.on((e) => events.push(e));
    c.step(2000);
    expect(events.some((e) => e.type === 'damage')).toBe(true);
  });
});
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement** (scaffold + auto-attack only)
```js
// src/systems/combatSim.js
import { makeRng } from '../core/rng.js';
import { rollHit } from './damage.js';
import { armorDR } from './stats.js';

export function createCombat({ hero, enemies, seed = 1 }) {
  const rng = makeRng(seed);
  const listeners = new Set();
  const state = { hero, enemies, result: null, time: 0 };
  const emit = (type, data) => { for (const fn of listeners) fn({ type, ...data }); };

  function aliveEnemies() { return state.enemies.filter((e) => e.alive); }

  function dealAutoAttack(src, target) {
    const dr = armorDR(target.armor, src.level);
    const baseDamage = src.weaponDmg + src.ap * 0.1;
    const { amount, crit } = rollHit({ baseDamage, critChance: src.critChance, targetDR: dr }, rng);
    target.hp = Math.max(0, target.hp - amount);
    emit('damage', { sourceId: src.id, targetId: target.id, amount, crit });
    if (src.resource?.type === 'rage') src.resource.value = Math.min(src.resource.max, src.resource.value + 10);
    if (target.hp === 0 && target.alive) { target.alive = false; emit('death', { id: target.id }); }
  }

  function stepUnitAutoAttack(unit, target, dt) {
    if (!unit.alive || !target) return;
    unit.autoAttackTimer -= dt;
    if (unit.autoAttackTimer <= 0) {
      unit.autoAttackTimer += unit.autoAttackEvery;
      dealAutoAttack(unit, target);
    }
  }

  function step(dt) {
    if (state.result) return;
    state.time += dt;
    // hero hits first alive enemy; enemies hit hero
    stepUnitAutoAttack(state.hero, aliveEnemies()[0], dt);
    for (const e of aliveEnemies()) stepUnitAutoAttack(e, state.hero, dt);
  }

  return {
    state,
    step,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
```
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** `feat(combat): CombatSim scaffold + deterministic auto-attacks`

---

## Task 7: CombatSim — abilities, enemy telegraph/block, win/lose

Extend `combatSim.js`. **Implement one test scenario at a time** (write the test, see it fail, implement, see it pass) in this order; commit after the whole battery is green.

**Files:** Modify `src/systems/combatSim.js`, `tests/systems/combatSim.test.js`

- [ ] **Step 1: Add these tests** (append to the existing describe file)
```js
import { getAbility } from '../../src/data/abilities.js';

describe('CombatSim abilities', () => {
  it('queued heroic_strike spends 15 rage and damages the target', () => {
    const c = fight();
    c.state.hero.resource.value = 50;
    const hp0 = c.state.enemies[0].hp;
    expect(c.queueAbility('heroic_strike')).toBe(true);
    c.step(16);
    expect(c.state.enemies[0].hp).toBeLessThan(hp0);
    expect(c.state.hero.resource.value).toBe(35);
  });
  it('rejects an ability when rage is insufficient', () => {
    const c = fight();
    c.state.hero.resource.value = 5;
    expect(c.queueAbility('heroic_strike')).toBe(false);
  });
  it('rejects an ability still on cooldown', () => {
    const c = fight();
    c.state.hero.resource.value = 100;
    expect(c.queueAbility('whirlwind')).toBe(true); c.step(16);
    expect(c.queueAbility('whirlwind')).toBe(false); // 6s cd
  });
  it('whirlwind hits every alive enemy', () => {
    const c = fight(1, ['waldwolf', 'keiler']);
    c.state.hero.resource.value = 100;
    const before = c.state.enemies.map((e) => e.hp);
    c.queueAbility('whirlwind'); c.step(16);
    c.state.enemies.forEach((e, i) => expect(e.hp).toBeLessThan(before[i]));
  });
  it('execute only gets its bonus when target is below 20% hp', () => {
    const c = fight();
    c.state.hero.resource.value = 100;
    const e = c.state.enemies[0];
    e.hp = e.maxHp; c.queueAbility('execute'); c.step(16);
    const highHpDealt = e.maxHp - e.hp;
    const c2 = fight();
    c2.state.hero.resource.value = 100;
    const e2 = c2.state.enemies[0]; e2.hp = Math.floor(e2.maxHp * 0.15);
    const before2 = e2.hp; c2.queueAbility('execute'); c2.step(16);
    expect(before2 - e2.hp).toBeGreaterThan(highHpDealt); // finisher bonus
  });
});

describe('CombatSim flow + telegraph', () => {
  it('declares won when all enemies die', () => {
    const c = fight();
    c.state.enemies[0].hp = 1;
    let ended = null; c.on((e) => { if (e.type === 'end') ended = e.result; });
    c.step(2000);
    expect(c.state.result).toBe('won'); expect(ended).toBe('won');
  });
  it('declares lost when the hero dies', () => {
    const c = fight();
    c.state.hero.hp = 1;
    c.step(6000); // enemy swings land
    expect(c.state.result).toBe('lost');
  });
  it('boss telegraph resolves a big hit; an active block reduces it', () => {
    const noBlock = fight(3, ['krell']);
    const withBlock = fight(3, ['krell']);
    // advance both to just after a telegraph resolves
    const run = (c, block) => {
      let told = false;
      c.on((e) => { if (e.type === 'telegraphStart' && !told) { told = true; if (block) { c.state.hero.resource.value = 100; c.queueAbility('shield_block'); } } });
      for (let i = 0; i < 250; i++) c.step(50); // 12.5s
      return c.state.hero.maxHp - c.state.hero.hp;
    };
    const dmgNoBlock = run(noBlock, false);
    const dmgBlock = run(withBlock, true);
    expect(dmgBlock).toBeLessThan(dmgNoBlock);
  });
});
```
- [ ] **Step 2: Run → FAIL** (new scenarios fail)
- [ ] **Step 3: Implement incrementally** until all pass. Implementation must add:
  - `queueAbility(id, targetId?)`: validate alive/result, `getAbility(id)`, rage ≥ cost, cooldown 0; if ok push to a `pending` queue and return `true`, else `false`.
  - In `step`: **process pending abilities first** — spend rage, set `cooldowns[id]=ability.cooldown`, then apply effect by `kind`:
    - `attack`/`execute`: `baseDamage = weaponDmg*weaponCoef + ap*apCoef`; for `execute`, if `target.hp/target.maxHp <= ability.threshold` keep coef, else use a reduced coef (e.g. `weaponCoef*0.4`) so it's weak above the threshold; apply via the same DR+rollHit path as auto-attack.
    - `aoe`: apply to every alive enemy.
    - `defensive` (shield_block): set `hero.blocking = ability.blockMs` and store `blockReduce`.
  - Decrement all `cooldowns[id]` by `dt` (floor at 0) and `hero.blocking` by `dt` each step.
  - **Enemy AI / telegraph:** in `step`, for each alive enemy with `ai`, decrement `ai.timer`; at ≤0 start `telegraph = { abilityId, remainingMs: special.castMs, mult }` and emit `telegraphStart`. Decrement `telegraph.remainingMs`; at ≤0 resolve: damage = `enemy.weaponDmg * special.mult` (through DR); if `hero.blocking > 0` multiply by `(1 - blockReduce)`; emit `telegraphResolve {blocked}`; reset `ai.timer = special.everyMs`.
  - **Boss phase 2:** when `enemy.phase2At` set and `hp/maxHp <= phase2At` and not `enraged`, set `enraged=true` and reduce `autoAttackEvery` by 30% (×0.7).
  - **Win/lose:** after applying effects, if no alive enemies → `state.result='won'`, emit `end {result:'won'}`; if `hero.hp===0` → `hero.alive=false`, `state.result='lost'`, emit `end {result:'lost'}`. Guard `step` to no-op once `result` set.
- [ ] **Step 4: Run → PASS** (full `combatSim.test.js` green)
- [ ] **Step 5: Commit** `feat(combat): abilities, telegraph/block reflex, boss phases, win-lose`

---

## Task 8: Sprites + combat screen (UI) — behaviour + live verify

**Files:** Create `src/ui/sprites.js`, `src/ui/combatScreen.js`

Functional pixel sprites now (polished in Plan 6). `sprites.js` exports `drawSprite(ctx, key, x, y, scale)` for keys `hero, wolf, bandit, boar, wolf_elite, krell` — each a small hand-coded pixel matrix (e.g. 16×16) painted with the palette; recognizable silhouettes are enough.

`combatScreen.js` exports `mountCombatScreen(rootEl, sim, { onEnd })` that:
- Renders a `<canvas>` scene: hero on the left, enemies on the right, drawn via `drawSprite`; a ground strip; floating damage numbers (pooled), red for hits, gold for crits.
- Renders DOM overlays: hero HP bar + rage bar; each enemy a small HP bar above its sprite; an **ability button row** (one button per `hero.abilities`, showing name, greyed on cooldown/insufficient rage) that calls `sim.queueAbility(id)`.
- Shows a **telegraph indicator** over the casting enemy (a filling bar) during `telegraphStart→Resolve`; the Schildblock button visibly highlights while `hero.blocking>0`.
- Runs its own rAF loop calling `sim.step(dt)` (respect a 1×/2× speed toggle), re-rendering bars/buttons, and on `end` event calls `onEnd(result)` and stops.

- [ ] **Step 1:** Implement `sprites.js` (matrices + `drawSprite`).
- [ ] **Step 2:** Implement `combatScreen.js` per the behaviour above.
- [ ] **Step 3: Live verify** — temporary harness: from `main.js` mount a single `krell`-less fight (`['waldwolf','keiler']`). `preview_start gildenerbe-dev`; `preview_screenshot` shows hero + two enemies, bars, buttons. `preview_eval` to tap an ability (`window.__combat.queueAbility('whirlwind')`) and confirm both enemy HP bars drop. Check `preview_console_logs level error` is empty.
- [ ] **Step 4: Commit** `feat(ui): combat screen + pixel sprites`

---

## Task 9: Run controller + Zone 1 (`src/run.js`, `src/data/zones.js`)

**Files:** Create `src/data/zones.js`, `src/run.js`

`zones.js`: 
```js
export const ZONE1 = {
  id: 'eichhain', name: 'Eichhain', levelRange: [1, 5],
  encounters: [
    ['waldwolf'], ['keiler', 'waldwolf'], ['raeuber'],
    ['rudelfuehrer'],            // elite
    ['krell'],                   // boss
  ],
};
```
`run.js` exports `createRun()` holding `{ hero: createHero('krieger'), zone: ZONE1, index: 0, result: null }` and:
- `currentEncounter()` → `makeEnemy`-built units for `encounters[index]`.
- `buildSim()` → `createCombat({ hero, enemies: currentEncounter(), seed })` (seed derived from index so deterministic but varied).
- `onCombatEnd(result)`: if `won` → carry hero hp forward, heal +30% of maxHp (between-fight recovery), `index++`; if past last encounter → `result='cleared'`. If `lost` → `result='fallen'`.
- No Erbe/reroll yet (Plan 5) — `cleared`/`fallen` just surface to the UI.

- [ ] **Step 1:** Implement `zones.js` + `run.js`.
- [ ] **Step 2:** (No unit test required, but) add a small `tests/systems/run.test.js`: a run that auto-wins each encounter (set enemy hp to 0 via stepping a stacked-rage hero, or directly mark) advances `index` and ends `cleared`; a lethal encounter ends `fallen`. Keep it deterministic.
- [ ] **Step 3: Commit** `feat(run): Zone-1 encounter sequencing + win/lose flow`

---

## Task 10: Wire into main.js + milestone verify + tag

**Files:** Modify `src/main.js`

Replace the tick-counter demo with the real entry: a start screen (“Neuer Held: Krieger” button) → begins a run → mounts the combat screen for each encounter → between encounters a brief “Sieg!” interstitial → on `cleared` an “Eichhain bezwungen!” screen, on `fallen` a “Gefallen” screen — both returning to start. Persist nothing run-specific yet beyond what already exists (account save stays; run is in-memory until Plan 5).

- [ ] **Step 1:** Implement the screen flow in `main.js` (start → run → combat → result).
- [ ] **Step 2: Live verify** the full slice: `preview_start`; screenshot start screen; `preview_eval` to start a run and auto-resolve via stepping; play one encounter by tapping abilities; confirm progression to the next encounter; reach an end screen. No console errors.
- [ ] **Step 3: Run full suite** `npm test` — all prior + new combat tests green.
- [ ] **Step 4: Commit** `feat: playable Zone-1 combat slice end-to-end` and **tag** `git tag v1-m2-combat`.

---

## Definition of Done (Plan 2)
- `npm test` green incl. stats/damage/abilities/enemies/hero/combatSim/run.
- In the browser: start a Krieger, fight Zone-1 encounters with real abilities + rage + cooldowns, survive a boss telegraph by blocking, and reach “Eichhain bezwungen!” or “Gefallen”.
- CombatSim is deterministic and UI-free; UI renders sim state only.

## Self-Review
- **Spec coverage:** combat minigame (spec §4/§5A) → Tasks 6–8; formulas (§4) → Tasks 1–2; Krieger kit (§3) → Tasks 3,5; enemies + boss telegraph/phases (§7) → Tasks 4,7; Zone-1 node sequence (§6) → Task 9; rarity/loot/leveling deferred to Plan 3 (noted). ✔
- **Placeholder scan:** none; Task 7 lists exact mechanics to implement against concrete tests. ✔
- **Type consistency:** unit shape, ability shape, event types reused verbatim across tasks; `queueAbility`, `createCombat`, `makeEnemy`, `createHero`, `getAbility`, `rollHit`, `armorDR`, `computeDerived` names match across tests/impl. ✔

*End of Plan 2. On completion → Plan 3 (Progression & Loot).*
