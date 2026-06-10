# Gildenerbe v1 — Plan 1: Fundament (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a runnable, tested project skeleton with the deterministic engine core (seeded RNG, event bus, save/load with versioning, offline-time math, game state, fixed-timestep loop) and a minimal boot UI that ticks and persists across reload.

**Architecture:** Vanilla JS (ES modules) bundled by Vite. Pure, side-effect-free engine modules in `src/core/` are unit-tested with Vitest (deterministic via injected seeds/time). A thin boot layer (`src/main.js`) wires storage + loop + a tiny DOM render to prove the foundation end-to-end. Storage is behind an interface so the web `localStorage` impl can later be swapped for Capacitor Preferences without touching game logic.

**Tech Stack:** Node 25, Vite, Vitest (+ jsdom), vanilla ES modules. No game framework. Data-driven config via plain JS modules.

---

## v1 Milestone Roadmap (context — this plan is #1 of 6)

1. **Fundament** *(this plan)* — scaffold + engine core + boot/save.
2. **Kampf-Kern** — stats, abilities, damage formulas, enemies, combat minigame, Zone 1 node-map.
3. **Progression & Loot** — leveling, talent draft, items/affixes/rarity, inventory & equip.
4. **Berufe & Minigames** — gathering, smelt→craft chain, fishing, rune-connection puzzle, perfect-cast.
5. **Meta-Loop** — Gildenhalle buildings, Erbe formula, reroll, offline-progress + "while away".
6. **Politur & APK** — pixel-art pass, chiptune + SFX, Capacitor packaging → installable APK.

Each milestone is its own plan written after the previous is built and reviewed. Source of truth for design: `docs/superpowers/specs/2026-06-10-gildenerbe-design.md`.

---

## File Structure (locked for this plan)

```
package.json                  # scripts + dev deps
vite.config.js                # build/dev config (root=src? no: root=., entry index.html)
vitest.config.js              # test config (jsdom env, globals)
index.html                    # mounts #app, loads src/main.js
src/
  main.js                     # boot: load|new state, start loop, render, autosave  (manual-verified)
  style.css                   # minimal shell styling
  core/
    rng.js                    # seeded RNG (mulberry32) + helpers
    eventBus.js               # pub/sub
    storage.js                # storage interface: memory + web(localStorage) impls
    save.js                   # save/load/clear with versioned migrations
    time.js                   # offline elapsed-seconds math (pure)
    state.js                  # initial game state factory + version constant
    loop.js                   # fixed-timestep accumulator loop (pure advance())
tests/
  core/
    rng.test.js
    eventBus.test.js
    storage.test.js
    save.test.js
    time.test.js
    state.test.js
    loop.test.js
```

Each `src/core/*.js` file has ONE responsibility and no imports from `ui`/`main`. All are pure or take their dependencies (storage, time, seed) as arguments → fully unit-testable.

---

## Task 0: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.js`, `vitest.config.js`, `index.html`, `src/main.js`, `src/style.css`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "gildenerbe",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "vitest": "^2.1.0",
    "jsdom": "^25.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` written, no error exit code.

- [ ] **Step 3: Create `vite.config.js`**

```js
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',            // relative asset paths — required for Capacitor (file://) later
  build: { outDir: 'dist', emptyOutDir: true },
  server: { port: 5173, open: false },
});
```

- [ ] **Step 4: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',   // gives tests localStorage + DOM
    globals: true,          // describe/it/expect without imports
    include: ['tests/**/*.test.js'],
  },
});
```

- [ ] **Step 5: Create `index.html`**

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Gildenerbe</title>
    <link rel="stylesheet" href="/src/style.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `src/style.css`**

```css
:root { color-scheme: dark; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: #1a1712; color: #e8dcc0;
  font-family: ui-monospace, "Courier New", monospace; }
#app { display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 24px; }
.panel { border: 2px solid #c8a04a; background: #241f17; border-radius: 8px;
  padding: 16px 20px; min-width: 260px; text-align: center; }
.panel h1 { color: #c8a04a; margin: 0 0 8px; font-size: 20px; letter-spacing: 2px; }
.stat { font-size: 14px; }
.stat b { color: #c8a04a; }
button { font: inherit; color: #1a1712; background: #c8a04a; border: none;
  border-radius: 6px; padding: 8px 14px; cursor: pointer; }
button:active { transform: translateY(1px); }
```

- [ ] **Step 7: Create placeholder `src/main.js` (wired fully in Task 7)**

```js
// Boot layer — fully implemented in Task 7 after the engine core exists.
const app = document.getElementById('app');
if (app) app.textContent = 'Gildenerbe – Fundament wird gebaut …';
```

- [ ] **Step 8: Verify dev server boots**

Run: `npm run dev` (then stop with Ctrl+C after confirming)
Expected: Vite prints `Local: http://localhost:5173/`; opening it shows the placeholder text with no console errors.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vite.config.js vitest.config.js index.html src/main.js src/style.css
git commit -m "chore: scaffold Vite + Vitest project skeleton"
```

---

## Task 1: Seeded RNG (`src/core/rng.js`)

**Files:**
- Create: `src/core/rng.js`
- Test: `tests/core/rng.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/core/rng.test.js
import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/core/rng.js';

describe('makeRng', () => {
  it('is deterministic for the same seed', () => {
    const a = makeRng(12345);
    const b = makeRng(12345);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it('produces values in [0,1)', () => {
    const r = makeRng(7);
    for (let i = 0; i < 100; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(min,max) is inclusive and within range', () => {
    const r = makeRng(99);
    for (let i = 0; i < 200; i++) {
      const v = r.int(3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('pick returns an element of the array deterministically', () => {
    const arr = ['a', 'b', 'c', 'd'];
    expect(makeRng(1).pick(arr)).toBe(makeRng(1).pick(arr));
    expect(arr).toContain(makeRng(1).pick(arr));
  });

  it('weighted respects weights (weight 0 never chosen)', () => {
    const r = makeRng(42);
    const counts = { x: 0, y: 0 };
    for (let i = 0; i < 1000; i++) {
      counts[r.weighted([{ item: 'x', weight: 3 }, { item: 'y', weight: 1 }, { item: 'z', weight: 0 }])]++;
    }
    expect(counts.x).toBeGreaterThan(counts.y); // ~3:1
    expect(counts.x + counts.y).toBe(1000);     // z (weight 0) never picked
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/rng.test.js`
Expected: FAIL — `Failed to resolve import "../../src/core/rng.js"` / `makeRng is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/core/rng.js
// Seeded PRNG (mulberry32). Returns a generator with helpers.
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    float: (min, max) => next() * (max - min) + min,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    weighted: (entries) => {
      const total = entries.reduce((s, e) => s + e.weight, 0);
      let r = next() * total;
      for (const e of entries) {
        r -= e.weight;
        if (r < 0) return e.item;
      }
      return entries[entries.length - 1].item;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/rng.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/rng.js tests/core/rng.test.js
git commit -m "feat(core): seeded RNG with int/pick/weighted helpers"
```

---

## Task 2: Event bus (`src/core/eventBus.js`)

**Files:**
- Create: `src/core/eventBus.js`
- Test: `tests/core/eventBus.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/core/eventBus.test.js
import { describe, it, expect, vi } from 'vitest';
import { createEventBus } from '../../src/core/eventBus.js';

describe('createEventBus', () => {
  it('calls handlers on emit with payload', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    bus.on('hit', fn);
    bus.emit('hit', { dmg: 5 });
    expect(fn).toHaveBeenCalledWith({ dmg: 5 });
  });

  it('supports multiple handlers for one type', () => {
    const bus = createEventBus();
    const a = vi.fn(); const b = vi.fn();
    bus.on('x', a); bus.on('x', b);
    bus.emit('x', 1);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('off removes a handler', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    bus.on('x', fn); bus.off('x', fn);
    bus.emit('x');
    expect(fn).not.toHaveBeenCalled();
  });

  it('on returns an unsubscribe function', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    const unsub = bus.on('x', fn);
    unsub();
    bus.emit('x');
    expect(fn).not.toHaveBeenCalled();
  });

  it('emitting an unknown type does not throw', () => {
    const bus = createEventBus();
    expect(() => bus.emit('nope')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/eventBus.test.js`
Expected: FAIL — `createEventBus is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/core/eventBus.js
export function createEventBus() {
  const map = new Map(); // type -> Set<fn>
  const bus = {
    on(type, fn) {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add(fn);
      return () => bus.off(type, fn);
    },
    off(type, fn) {
      map.get(type)?.delete(fn);
    },
    emit(type, payload) {
      const set = map.get(type);
      if (!set) return;
      for (const fn of [...set]) fn(payload);
    },
  };
  return bus;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/eventBus.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/eventBus.js tests/core/eventBus.test.js
git commit -m "feat(core): event bus (on/off/emit + unsubscribe)"
```

---

## Task 3: Storage interface (`src/core/storage.js`)

**Files:**
- Create: `src/core/storage.js`
- Test: `tests/core/storage.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/core/storage.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryStorage, createWebStorage } from '../../src/core/storage.js';

describe('createMemoryStorage', () => {
  it('round-trips set/get and returns null for missing keys', () => {
    const s = createMemoryStorage();
    expect(s.getItem('k')).toBeNull();
    s.setItem('k', 'v');
    expect(s.getItem('k')).toBe('v');
  });

  it('removeItem deletes the key', () => {
    const s = createMemoryStorage();
    s.setItem('k', 'v');
    s.removeItem('k');
    expect(s.getItem('k')).toBeNull();
  });
});

describe('createWebStorage', () => {
  beforeEach(() => localStorage.clear());
  it('reads and writes through localStorage', () => {
    const s = createWebStorage();
    s.setItem('a', '1');
    expect(localStorage.getItem('a')).toBe('1');
    expect(s.getItem('a')).toBe('1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/storage.test.js`
Expected: FAIL — `createMemoryStorage is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/core/storage.js
// Storage interface: { getItem(key)->string|null, setItem(key,val), removeItem(key) }.
// Swap createWebStorage() for a Capacitor Preferences adapter later — game code stays the same.

export function createMemoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

export function createWebStorage() {
  return {
    getItem: (k) => localStorage.getItem(k),
    setItem: (k, v) => localStorage.setItem(k, String(v)),
    removeItem: (k) => localStorage.removeItem(k),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/storage.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/storage.js tests/core/storage.test.js
git commit -m "feat(core): storage interface (memory + web/localStorage impls)"
```

---

## Task 4: Save/load with versioned migrations (`src/core/save.js`)

**Files:**
- Create: `src/core/save.js`
- Test: `tests/core/save.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/core/save.test.js
import { describe, it, expect } from 'vitest';
import { createMemoryStorage } from '../../src/core/storage.js';
import { saveGame, loadGame, clearSave, SAVE_VERSION } from '../../src/core/save.js';

describe('save/load', () => {
  it('round-trips state', () => {
    const s = createMemoryStorage();
    const state = { version: SAVE_VERSION, meta: { erbe: 42 } };
    saveGame(s, state);
    expect(loadGame(s)).toEqual(state);
  });

  it('returns null when nothing is saved', () => {
    expect(loadGame(createMemoryStorage())).toBeNull();
  });

  it('returns null on corrupt JSON', () => {
    const s = createMemoryStorage();
    s.setItem('gildenerbe.save', '{not json');
    expect(loadGame(s)).toBeNull();
  });

  it('clearSave removes the save', () => {
    const s = createMemoryStorage();
    saveGame(s, { version: SAVE_VERSION, meta: {} });
    clearSave(s);
    expect(loadGame(s)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/save.test.js`
Expected: FAIL — `saveGame is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/core/save.js
export const SAVE_KEY = 'gildenerbe.save';
export const SAVE_VERSION = 1;

// migrations[n] upgrades a state saved at version n to version n+1.
const migrations = {
  // 1: (state) => ({ ...state, newField: default }),  // example for the future
};

export function saveGame(storage, state) {
  storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state }));
}

export function loadGame(storage) {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  let { version, state } = data;
  if (state === undefined) return null;
  while (version < SAVE_VERSION && migrations[version]) {
    state = migrations[version](state);
    version++;
  }
  return state;
}

export function clearSave(storage) {
  storage.removeItem(SAVE_KEY);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/save.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/save.js tests/core/save.test.js
git commit -m "feat(core): versioned save/load with migration hook"
```

---

## Task 5: Offline elapsed-time math (`src/core/time.js`)

**Files:**
- Create: `src/core/time.js`
- Test: `tests/core/time.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/core/time.test.js
import { describe, it, expect } from 'vitest';
import { computeElapsedSeconds } from '../../src/core/time.js';

describe('computeElapsedSeconds', () => {
  it('returns whole seconds between two timestamps', () => {
    expect(computeElapsedSeconds(0, 5000, 99999)).toBe(5);
    expect(computeElapsedSeconds(0, 5999, 99999)).toBe(5); // floors
  });

  it('clamps to the cap', () => {
    expect(computeElapsedSeconds(0, 60_000, 30)).toBe(30);
  });

  it('never returns negative (clock moved backwards)', () => {
    expect(computeElapsedSeconds(10_000, 5_000, 99999)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/time.test.js`
Expected: FAIL — `computeElapsedSeconds is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/core/time.js
// Pure: caller passes Date.now() in. Keeps offline math deterministic & testable.
export function computeElapsedSeconds(lastMs, nowMs, capSeconds) {
  const elapsed = Math.floor((nowMs - lastMs) / 1000);
  if (elapsed < 0) return 0;
  return Math.min(elapsed, capSeconds);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/time.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/time.js tests/core/time.test.js
git commit -m "feat(core): offline elapsed-seconds math (clamped, floored)"
```

---

## Task 6: Initial game state (`src/core/state.js`)

**Files:**
- Create: `src/core/state.js`
- Test: `tests/core/state.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/core/state.test.js
import { describe, it, expect } from 'vitest';
import { createInitialState, GAME_VERSION } from '../../src/core/state.js';

describe('createInitialState', () => {
  it('starts a fresh account with no run and zero Erbe', () => {
    const s = createInitialState();
    expect(s.version).toBe(GAME_VERSION);
    expect(s.run).toBeNull();
    expect(s.meta.erbe).toBe(0);
  });

  it('unlocks the Krieger class by default', () => {
    expect(createInitialState().meta.unlockedClasses).toContain('krieger');
  });

  it('returns a fresh object each call (no shared references)', () => {
    const a = createInitialState();
    const b = createInitialState();
    a.meta.erbe = 999;
    expect(b.meta.erbe).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/state.test.js`
Expected: FAIL — `createInitialState is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/core/state.js
export const GAME_VERSION = 1;

// The full account/save shape. `run` is null when no hero is active.
export function createInitialState() {
  return {
    version: GAME_VERSION,
    createdAt: 0,        // set by boot layer (Date.now)
    lastSaved: 0,        // set on save
    settings: { musicVolume: 0.6, sfxVolume: 0.8 },
    meta: {
      erbe: 0,
      buildings: {},          // { buildingId: level }
      unlockedClasses: ['krieger'],
      knownRecipes: [],
      reputation: {},         // { factionId: points }
    },
    run: null,                // active hero run (filled in Plan 2)
    stats: { totalRuns: 0, bestZone: 0, playTicks: 0 },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/state.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/state.js tests/core/state.test.js
git commit -m "feat(core): initial game state factory + version constant"
```

---

## Task 7: Fixed-timestep loop (`src/core/loop.js`)

**Files:**
- Create: `src/core/loop.js`
- Test: `tests/core/loop.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/core/loop.test.js
import { describe, it, expect, vi } from 'vitest';
import { createLoop } from '../../src/core/loop.js';

describe('createLoop', () => {
  it('runs one tick per dt accumulated', () => {
    const tick = vi.fn();
    const loop = createLoop({ tick, dt: 100 });
    expect(loop.advance(100)).toBe(1);
    expect(tick).toHaveBeenCalledTimes(1);
    expect(tick).toHaveBeenCalledWith(100);
  });

  it('runs multiple ticks for a large delta and keeps the remainder', () => {
    const tick = vi.fn();
    const loop = createLoop({ tick, dt: 100 });
    expect(loop.advance(250)).toBe(2);       // 2 full ticks
    expect(loop.accumulator).toBeCloseTo(50); // 50ms left over
  });

  it('caps ticks at maxSteps to avoid a spiral of death', () => {
    const tick = vi.fn();
    const loop = createLoop({ tick, dt: 100, maxSteps: 3 });
    expect(loop.advance(10_000)).toBe(3);
    expect(loop.accumulator).toBe(0);        // remainder dropped when capped
  });

  it('does not tick when less than dt has accumulated', () => {
    const tick = vi.fn();
    const loop = createLoop({ tick, dt: 100 });
    expect(loop.advance(50)).toBe(0);
    expect(tick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/loop.test.js`
Expected: FAIL — `createLoop is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/core/loop.js
// Fixed-timestep accumulator. advance(elapsedMs) runs `tick(dt)` as many
// whole dt-steps as fit, returns the number of steps taken. Pure & testable:
// the host (main.js) supplies elapsed time from requestAnimationFrame.
export function createLoop({ tick, dt = 1000 / 30, maxSteps = 5 }) {
  let acc = 0;
  return {
    advance(elapsedMs) {
      acc += elapsedMs;
      let steps = 0;
      while (acc >= dt && steps < maxSteps) {
        tick(dt);
        acc -= dt;
        steps++;
      }
      if (steps === maxSteps && acc >= dt) acc = 0; // drop backlog when overloaded
      return steps;
    },
    get accumulator() {
      return acc;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/loop.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/loop.js tests/core/loop.test.js
git commit -m "feat(core): fixed-timestep accumulator loop"
```

---

## Task 8: Boot layer wiring (`src/main.js`) — manual-verified

This ties the core together and proves the foundation: on start it loads a save (or makes a new state, stamping `createdAt`), runs the loop incrementing `stats.playTicks`, renders a small panel, autosaves every 5s and when the tab is hidden. No unit test (DOM/timing glue); verified by running it.

**Files:**
- Modify: `src/main.js` (replace placeholder from Task 0)

- [ ] **Step 1: Replace `src/main.js` with the full boot layer**

```js
// src/main.js
import { createWebStorage } from './core/storage.js';
import { loadGame, saveGame } from './core/save.js';
import { createInitialState } from './core/state.js';
import { createLoop } from './core/loop.js';
import { createEventBus } from './core/eventBus.js';

const storage = createWebStorage();
const bus = createEventBus();

// Load existing save or start a fresh account.
let state = loadGame(storage);
const isNew = !state;
if (isNew) {
  state = createInitialState();
  state.createdAt = Date.now();
}

// One tick = one fixed step; count it so we can SEE the loop running & persisting.
function tick() {
  state.stats.playTicks += 1;
}

const loop = createLoop({ tick, dt: 1000 / 30 });

function save() {
  state.lastSaved = Date.now();
  saveGame(storage, state);
  bus.emit('saved', state.lastSaved);
}

// --- minimal render ---
const app = document.getElementById('app');
function render() {
  app.innerHTML = `
    <div class="panel">
      <h1>GILDENERBE</h1>
      <div class="stat">Status: <b>${isNew ? 'Neues Spiel' : 'Fortgesetzt'}</b></div>
      <div class="stat">Ticks: <b id="ticks">${state.stats.playTicks}</b></div>
      <div class="stat">Erbe: <b>${state.meta.erbe}</b></div>
      <div class="stat">Klassen: <b>${state.meta.unlockedClasses.join(', ')}</b></div>
    </div>
    <button id="reset">Spielstand zurücksetzen</button>
  `;
  document.getElementById('reset').onclick = () => {
    storage.removeItem('gildenerbe.save');
    location.reload();
  };
}
render();

// rAF drives the loop; update only the ticks number each frame (cheap).
let last = performance.now();
const ticksEl = () => document.getElementById('ticks');
function frame(now) {
  loop.advance(now - last);
  last = now;
  const el = ticksEl();
  if (el) el.textContent = state.stats.playTicks;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// autosave: interval + on tab hide (mobile background)
setInterval(save, 5000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') save();
});

// expose for manual debugging in the console
window.__GE = { get state() { return state; }, save };
```

- [ ] **Step 2: Run the dev server and verify the loop + persistence by hand**

Run: `npm run dev`
Then in a browser at `http://localhost:5173/`:
1. The panel shows `Status: Neues Spiel` and `Ticks:` climbing (~30/sec).
2. Wait >5s (autosave fires), then reload the page (F5).
3. Expected: `Status: Fortgesetzt` and the tick count is **at or above** where it was before reload (persisted).
4. Click "Spielstand zurücksetzen" → reloads as `Neues Spiel`, ticks restart at 0.
5. Browser console: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all suites pass (rng, eventBus, storage, save, time, state, loop) — 27 tests green.

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "feat: boot layer wiring loop + save + render (foundation runnable)"
```

- [ ] **Step 5: Tag the milestone**

```bash
git tag v1-m1-foundation
```

---

## Definition of Done (Plan 1)

- `npm test` → all core tests pass (deterministic).
- `npm run dev` → app boots, ticks visibly, autosaves, and **resumes** after reload; reset works.
- `npm run build` → produces `dist/` with relative asset paths (Capacitor-ready) and no errors.
- Engine core (`rng`, `eventBus`, `storage`, `save`, `time`, `state`, `loop`) is isolated, pure, and unit-tested — the testable backbone every later milestone builds on.

---

## Self-Review

**Spec coverage (foundation-relevant items):**
- Seeded RNG (spec §17 "seeded RNG") → Task 1. ✔
- Save via storage + versioned schema/migrations (spec §17 "versioniertes Schema") → Tasks 3–4. ✔
- Offline-time math (spec §14 "Offline-Berechnung") → Task 5 (consumed by Plan 5). ✔
- Game loop / fixed tick (spec §17 "Game-Loop, Zeit/Tick") → Task 7. ✔
- Event bus (spec §17 "Event-Bus") → Task 2. ✔
- Account/meta state shape with Erbe, buildings, unlockedClasses, knownRecipes, reputation (spec §10–11) → Task 6. ✔
- Capacitor-ready build (`base: './'`) (spec §17 packaging) → Task 0. ✔
- Storage swappable for Capacitor Preferences (spec §17) → Task 3 (interface). ✔
- Combat/loot/professions/gildenhalle/minigames → deferred to Plans 2–5 by design (out of scope here). ✔ (documented in roadmap)

**Placeholder scan:** No "TBD/TODO/handle edge cases". The single comment placeholder in Task 0 `src/main.js` is explicitly replaced in Task 7. `migrations` is intentionally empty with a documented example (correct for version 1). ✔

**Type/name consistency:** `makeRng`, `createEventBus`, `createMemoryStorage`/`createWebStorage`, `saveGame`/`loadGame`/`clearSave`/`SAVE_KEY`/`SAVE_VERSION`, `computeElapsedSeconds`, `createInitialState`/`GAME_VERSION`, `createLoop` — names match across tests, implementations, and `main.js` imports. Save key string `'gildenerbe.save'` matches between `save.js` (`SAVE_KEY`) and the reset button in `main.js`. ✔

---

*End of Plan 1. On completion, write Plan 2 (Kampf-Kern) referencing the same spec.*
