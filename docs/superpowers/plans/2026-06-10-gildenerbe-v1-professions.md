# Gildenerbe v1 — Plan 4: Berufe & Minigames (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Checkbox (`- [ ]`) steps.

**Goal:** Add the two remaining minigame pillars + a crafting backbone: **Angeln** (reflex/timing), **Perfekt-Wirken** beim Schmieden (reflex), and the **Runen-Verbindungs-Puzzle** (logic → enchant). A **Werkstatt** hub between encounters holds materials and links the minigames; kills now also drop materials.

**Architecture:** Pure, deterministic systems (materials/fishing/crafting/runePuzzle/enchanting) tested with Vitest; UI screens render state and call the systems. The Werkstatt hub is reachable from the run interstitial. Materials live on the `run` for now (account/Gildenhalle persistence = Plan 5).

**Tech Stack:** vanilla ES modules, Vitest (node), Canvas/DOM UI.

---

## File Structure
```
src/
  data/recipes.js          # smelt + craft recipes, fish table
  systems/
    materials.js           # bag helpers: add/has/consume
    fishing.js             # reflex catch logic (deterministic)
    crafting.js            # smelt/craft + perfect-cast quality
    runePuzzle.js          # generate solvable connect-puzzle + validate
    enchanting.js          # apply a solved puzzle as an affix on an item
  ui/
    workshopScreen.js      # hub: materials + buttons
    fishingScreen.js       # fishing minigame
    craftScreen.js         # smelt/craft with perfect-cast bar
    runePuzzleScreen.js    # rune-connection grid
  run.js                   # MODIFY: materials bag + mats in grantRewards
  main.js                  # MODIFY: "Werkstatt" button -> hub
tests/systems/{materials,fishing,crafting,runePuzzle,enchanting}.test.js
```

---

## Task 1: Materials + recipes + drops

**Files:** Create `src/systems/materials.js`, `src/data/recipes.js`; Modify `src/run.js`; Test `tests/systems/materials.test.js`

- [ ] **Step 1: Test**
```js
import { describe, it, expect } from 'vitest';
import { makeBag, addMat, hasMats, consumeMats } from '../../src/systems/materials.js';
describe('materials bag', () => {
  it('adds and reports materials', () => {
    const b = makeBag(); addMat(b, 'kupfererz', 3); addMat(b, 'kupfererz', 2);
    expect(b.kupfererz).toBe(5);
  });
  it('hasMats / consumeMats respect a cost', () => {
    const b = makeBag(); addMat(b, 'kupfererz', 4);
    expect(hasMats(b, { kupfererz: 5 })).toBe(false);
    expect(hasMats(b, { kupfererz: 3 })).toBe(true);
    expect(consumeMats(b, { kupfererz: 3 })).toBe(true);
    expect(b.kupfererz).toBe(1);
    expect(consumeMats(b, { kupfererz: 5 })).toBe(false); // unchanged on failure
    expect(b.kupfererz).toBe(1);
  });
});
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement `materials.js`**
```js
export const MATERIALS = ['kupfererz', 'eisenerz', 'kraeuter', 'fisch', 'kupferbarren', 'eisenbarren'];
export const makeBag = () => Object.fromEntries(MATERIALS.map((m) => [m, 0]));
export const addMat = (bag, key, n = 1) => { bag[key] = (bag[key] || 0) + n; };
export const hasMats = (bag, cost) => Object.entries(cost).every(([k, v]) => (bag[k] || 0) >= v);
export function consumeMats(bag, cost) {
  if (!hasMats(bag, cost)) return false;
  for (const [k, v] of Object.entries(cost)) bag[k] -= v;
  return true;
}
```
   **and `data/recipes.js`**
```js
// Smelt: ore -> bar. Craft: bars -> gear. Brew: herbs -> heal potion.
export const SMELT = {
  kupferbarren: { in: { kupfererz: 2 }, out: 'kupferbarren' },
  eisenbarren: { in: { eisenerz: 2 }, out: 'eisenbarren' },
};
export const CRAFT = {
  kupferruestung: { name: 'Kupfer-Rüstung', in: { kupferbarren: 3 }, slot: 'brust', ilvl: 4 },
  eisenklinge: { name: 'Eisenklinge', in: { eisenbarren: 3 }, slot: 'waffe', ilvl: 6 },
};
export const FISH_TABLE = [
  { id: 'schlammkarpfen', name: 'Schlammkarpfen', weight: 50 },
  { id: 'silberfisch', name: 'Silberfisch', weight: 30 },
  { id: 'goldforelle', name: 'Goldforelle', weight: 15 },
  { id: 'runenaal', name: 'Runenaal', weight: 5 },
];
```
- [ ] **Step 4: Modify `run.js`** — add `materials: makeBag()` to the run; in `grantRewards`, drop a little ore/herbs per kill: `enemies.forEach(e => { addMat(run.materials, 'kupfererz', 1 + (e.elite||e.boss?2:0)); if (rng?) ... })`. Concretely, deterministic: `addMat(run.materials,'kupfererz', e.boss?5:e.elite?3:1); addMat(run.materials,'kraeuter', 1);` Return drops as before; include `mats` summary in the return.
- [ ] **Step 5: Run → PASS**; **Commit** `feat(prof): materials bag + recipes + kill drops`

---

## Task 2: Fishing minigame (`fishing.js` + `fishingScreen.js`)

**Files:** Create both; Test `tests/systems/fishing.test.js`

The logic models one cast as a state machine; the UI drives time and the tap.
- [ ] **Step 1: Test**
```js
import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/core/rng.js';
import { createCast } from '../../src/systems/fishing.js';

describe('fishing cast', () => {
  it('bites after a delay, opens a catch window, and a tap inside it catches a fish', () => {
    const c = createCast(makeRng(1));
    c.step(c.biteDelayMs);           // advance to the bite
    expect(c.state).toBe('window');
    const fish = c.tap();            // tap inside the window
    expect(c.state).toBe('caught');
    expect(fish).toBeTruthy();
    expect(fish.id).toBeTruthy();
  });
  it('a tap before the bite fails the cast', () => {
    const c = createCast(makeRng(1));
    c.step(10);
    expect(c.tap()).toBeNull();
    expect(c.state).toBe('failed');
  });
  it('letting the window expire fails the cast', () => {
    const c = createCast(makeRng(1));
    c.step(c.biteDelayMs + c.windowMs + 1);
    expect(c.state).toBe('failed');
  });
});
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement `fishing.js`** — `createCast(rng)` returns `{ state:'waiting'|'window'|'caught'|'failed', biteDelayMs (rng 1500–4500), windowMs (~900), elapsed, step(dt), tap() }`. `step` transitions waiting→window at biteDelay, window→failed after windowMs. `tap()`: in 'waiting'→ state 'failed', return null; in 'window'→ pick a fish via `rng.weighted(FISH_TABLE)`, state 'caught', return fish; else null. Tighter remaining-window → bias toward rarer fish (optional: scale weights by how early the tap was).
- [ ] **Step 4: Run → PASS**; implement `fishingScreen.js` (a pond canvas, a bobber, a "!" + shrinking ring during the window, a big tap button; on catch show the fish; yields go to `run.materials.fisch++` and rare fish → bonus). **Live-verify** via preview (screenshot the window state; eval the tap → caught). **Commit** `feat(prof): fishing reflex minigame`

---

## Task 3: Crafting + Perfekt-Wirken (`crafting.js` + `craftScreen.js`)

**Files:** Create both; Test `tests/systems/crafting.test.js`

- [ ] **Step 1: Test**
```js
import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/core/rng.js';
import { makeBag, addMat } from '../../src/systems/materials.js';
import { smelt, craft } from '../../src/systems/crafting.js';

describe('crafting', () => {
  it('smelt consumes ore and yields a bar', () => {
    const bag = makeBag(); addMat(bag, 'kupfererz', 2);
    expect(smelt(bag, 'kupferbarren')).toBe(true);
    expect(bag.kupferbarren).toBe(1);
    expect(bag.kupfererz).toBe(0);
    expect(smelt(bag, 'kupferbarren')).toBe(false); // no ore left
  });
  it('craft consumes bars and returns an item; perfect cast raises rarity', () => {
    const bag = makeBag(); addMat(bag, 'kupferbarren', 6);
    const normal = craft(bag, 'kupferruestung', 0.0, makeRng(1)); // quality 0
    const perfect = craft(bag, 'kupferruestung', 1.0, makeRng(1)); // quality 1
    expect(normal.slot).toBe('brust');
    const order = ['grau', 'weiss', 'gruen', 'blau', 'lila', 'orange'];
    expect(order.indexOf(perfect.rarity)).toBeGreaterThanOrEqual(order.indexOf(normal.rarity));
  });
});
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement `crafting.js`** — `smelt(bag, barKey)`: look up `SMELT[barKey]`, `consumeMats(bag, .in)`, `addMat(bag, .out)`. `craft(bag, recipeKey, quality∈[0,1], rng)`: consume `.in`; build an item at `recipe.ilvl` with affixes (reuse the loot affix roller, or roll 1–2 affixes); `quality` raises rarity (e.g., quality≥0.8 → +1 rarity tier, perfect → chance +2). Return the item (caller pushes to inventory). The **perfect-cast** value (0..1) comes from the UI minigame.
- [ ] **Step 4: Run → PASS**; implement `craftScreen.js` — list smeltable bars + craftable recipes (greyed if mats missing); crafting opens a **sweeping marker bar** with a "perfect zone"; tapping computes `quality` from how close to centre; then `craft(...)` and show the result. **Live-verify**. **Commit** `feat(prof): smelting + crafting with perfect-cast quality`

---

## Task 4: Rune-connection puzzle (`runePuzzle.js` + `runePuzzleScreen.js`)

**Files:** Create both; Test `tests/systems/runePuzzle.test.js`

- [ ] **Step 1: Test**
```js
import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/core/rng.js';
import { generatePuzzle, validate } from '../../src/systems/runePuzzle.js';

describe('rune puzzle', () => {
  it('generates a puzzle whose own carved paths are a valid solution', () => {
    const p = generatePuzzle(makeRng(3), { size: 5, pairs: 3 });
    expect(p.endpoints.length).toBe(3);
    expect(validate(p, p.solution)).toBe(true); // generator solution is valid
  });
  it('rejects crossing / disconnected paths', () => {
    const p = generatePuzzle(makeRng(3), { size: 5, pairs: 3 });
    const broken = p.solution.map((path) => path.slice(0, 1)); // each path = just its start
    expect(validate(p, broken)).toBe(false);
  });
});
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement `runePuzzle.js`** — `generatePuzzle(rng,{size,pairs})`: maintain a `used` grid; for each pair, pick a random unused cell, random-walk (4-dir, avoiding used/out-of-bounds) a few steps marking cells with the pair index; the first & last cells become that pair's endpoints; store the walked path. Retry the whole generation (up to ~40 tries) if a pair can't place a length≥2 path; final fallback: a trivial 2-pair adjacent layout. Returns `{ size, endpoints:[{idx,a,b}], solution:[path,...] }` where each `path` is `[{x,y},...]` from a to b. `validate(p, paths)`: paths length == pairs; each path starts at `a`, ends at `b`, every step 4-adjacent & in-bounds; no cell shared across different paths. (Filling the board is NOT required.)
- [ ] **Step 4: Run → PASS**; implement `runePuzzleScreen.js` — render the grid; endpoints as coloured rune nodes; tap an endpoint to start its path, tap adjacent cells to extend (tap an occupied own-cell to backtrack), reaching the matching endpoint completes the pair; a **Reset** button; when `validate` passes → `onSolve(quality)` where quality scales with grid size/pairs. **Live-verify** (screenshot grid; eval-build a valid path set and confirm solved). **Commit** `feat(prof): rune-connection logic puzzle`

---

## Task 5: Enchanting + Werkstatt hub + integration + verify + tag

**Files:** Create `src/systems/enchanting.js`, `src/ui/workshopScreen.js`; Modify `src/main.js`; Test `tests/systems/enchanting.test.js`

- [ ] **Step 1: Test (enchanting)**
```js
import { describe, it, expect } from 'vitest';
import { createHero, recomputeHero } from '../../src/systems/hero.js';
import { enchantItem } from '../../src/systems/enchanting.js';

describe('enchanting', () => {
  it('adds an affix to an item and recomputes when equipped', () => {
    const h = createHero('krieger');
    const item = { id: 'i', slot: 'brust', rarity: 'gruen', ilvl: 4, affixes: { str: 3 } };
    h.equipment.brust = item; recomputeHero(h);
    const ap0 = h.ap;
    enchantItem(h, item, { key: 'str', value: 4 });
    expect(item.affixes.str).toBe(7);
    expect(h.ap).toBe(ap0 + 8); // +4 STR via recompute
  });
});
```
- [ ] **Step 2: Implement `enchanting.js`** — `enchantItem(hero, item, affix)`: `item.affixes[affix.key] = (item.affixes[affix.key]||0)+affix.value; item.enchanted = true; recomputeHero(hero)`. The puzzle's `quality` → affix value (e.g., `Math.round(2 + quality*4)`), key chosen by the item's slot or player.
- [ ] **Step 3: `workshopScreen.js`** — hub showing the materials bag and four buttons: **Angeln**, **Schmieden**, **Verzaubern**, **Zurück**. Each mounts the respective screen, returning to the hub on close. Enchant flow: pick an item (inventory/equipped) → open the rune puzzle → on solve, `enchantItem` with the quality-scaled affix.
- [ ] **Step 4: `main.js`** — add a **Werkstatt** button to the interstitial that opens the hub (and returns to the interstitial). Pass `run.materials` + `run.hero` through.
- [ ] **Step 5: Live-verify the loop** — start a run, win a fight, open **Werkstatt**: see materials from the kill; fish a fish; smelt ore→bar then craft an item (with a perfect-cast); enchant an item via the puzzle; confirm the item/stat changes. No console errors.
- [ ] **Step 6: Full suite** `npm test` (all Plan 1–4 green). **Commit** `feat: professions + minigames integrated via Werkstatt hub` and **tag** `git tag v1-m4-professions`.

---

## Definition of Done (Plan 4)
- `npm test` green incl. materials/fishing/crafting/runePuzzle/enchanting.
- In the browser: between encounters, the Werkstatt lets you **fish** (reflex), **craft** with **perfect-cast** (reflex), and **enchant** via the **rune puzzle** (logic); materials come from kills; crafted/enchanted gear improves the hero.
- All three minigame pillars (combat from Plan 2, reflex, logic) now present.

## Self-Review
- **Spec coverage:** professions/gathering + crafting chain (§9) → T1,T3; fishing reflex (§5B) → T2; perfect-cast (§5B) → T3; rune-connection logic puzzle (§5C) → T4; enchanting affixes (§5C,§8) → T5. Automation of professions deferred to Plan 5 (§10) — noted.
- **Placeholder scan:** none; UI tasks list behaviours + verification.
- **Type consistency:** `makeBag/addMat/hasMats/consumeMats`, `createCast`, `smelt/craft`, `generatePuzzle/validate`, `enchantItem` reused across tasks/tests; item shape + `recomputeHero` consistent with Plan 3.

*End of Plan 4. On completion → Plan 5 (Meta-Loop: Gildenhalle/Erbe/Reroll/Offline).*
