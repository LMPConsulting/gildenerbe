# Gildenerbe v1 — Plan 3: Progression & Loot (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax.

**Goal:** The hero now grows: kills grant XP → level-ups (stat growth + a **talent draft**, pick 1 of 3); enemies drop **items** with rarity colours and ilvl-scaled affixes; a **character/inventory screen** lets you equip gear, which recomputes the hero's stats. Result: the hero gets strong enough to clear Zone 1.

**Architecture:** A single `recomputeHero(hero)` derives all combat stats from `primaryBase + level + equipped item affixes + talent mods`, preserving the current HP ratio. Leveling, talents, loot, and equipment are pure modules that mutate the hero and call `recomputeHero`. Combat (Plan 2) is untouched — it still reads the same top-level fields (`maxHp/ap/weaponDmg/critChance/armor`). UI renders hero/inventory state; reward processing lives in `run`/`main`.

**Tech Stack:** vanilla ES modules, Vitest (node env), Canvas/DOM UI (Plan 2 patterns).

---

## File Structure

```
src/
  data/
    talents.js       # talent pool (id, name, desc, stat mods)
    affixes.js       # affix pool + rarity table + slot names
  systems/
    hero.js          # MODIFY: primaryBase/equipment/talentMods + recomputeHero()
    leveling.js      # xpForLevel(), addXp() -> level-ups + pending drafts
    talentDraft.js   # draftTalents(rng,n), applyTalent(hero,id)
    loot.js          # rollLoot(enemy, rng) -> item|null
    equipment.js     # equipItem(hero, item) -> previous|null
  ui/
    characterScreen.js  # equipment slots + inventory + equip + stat deltas
  run.js             # MODIFY: lootRng + reward bundling
  main.js            # MODIFY: rewards/levelup/draft overlays + character screen
tests/
  systems/{hero,leveling,talentDraft,loot,equipment}.test.js   (hero.test.js extended)
  data/{talents,affixes}.test.js
```

---

## Shared definitions

**Item shape:** `{ id, name, slot, rarity, ilvl, weaponDmg?, affixes: {str?,agi?,int?,sta?,crit?,ap?,armor?,hp?} }`
**Slots (equipment keys):** `waffe, kopf, brust, beine, haende, fuesse, ring1, ring2, amulett, umhang`
**recomputeHero contract:** reads `hero.primaryBase {str,agi,int,sta}`, `hero.level`, `hero.baseArmor`, `hero.baseWeaponDmg`, `hero.equipment {slot:item|null}`, `hero.talentMods {str,agi,int,sta,crit,ap,armor,hp}`. Writes `hero.primary`, `hero.maxHp/ap/critChance/armor/weaponDmg`, and rescales `hero.hp` to preserve ratio.

---

## Task 1: Hero recompute refactor (`src/systems/hero.js`)

**Files:** Modify `src/systems/hero.js`; extend `tests/systems/hero.test.js`.

- [ ] **Step 1: Add tests** (append)
```js
import { recomputeHero, SLOTS } from '../../src/systems/hero.js';

describe('recomputeHero', () => {
  it('adds equipped-item affixes into derived stats', () => {
    const h = createHero('krieger');
    const ap0 = h.ap;
    h.equipment.brust = { id: 'x', name: 'Platte', slot: 'brust', rarity: 'gruen', ilvl: 3, affixes: { str: 5 } };
    recomputeHero(h);
    expect(h.ap).toBe(ap0 + 5 * 2); // +5 STR -> +10 AP
  });
  it('applies talent mods (flat ap, crit, hp)', () => {
    const h = createHero('krieger');
    const hp0 = h.maxHp;
    h.talentMods.hp = 40; h.talentMods.crit = 0.05;
    const crit0 = h.critChance;
    recomputeHero(h);
    expect(h.maxHp).toBe(hp0 + 40);
    expect(h.critChance).toBeCloseTo(crit0 + 0.05);
  });
  it('preserves HP ratio across recompute', () => {
    const h = createHero('krieger');
    h.hp = Math.round(h.maxHp * 0.5);
    h.equipment.kopf = { id: 'k', slot: 'kopf', affixes: { sta: 10 }, ilvl: 1, rarity: 'gruen' };
    recomputeHero(h);
    expect(h.hp / h.maxHp).toBeCloseTo(0.5, 1);
  });
  it('equipped weapon overrides base weaponDmg', () => {
    const h = createHero('krieger');
    h.equipment.waffe = { id: 'w', slot: 'waffe', weaponDmg: 25, affixes: {}, ilvl: 5, rarity: 'blau' };
    recomputeHero(h);
    expect(h.weaponDmg).toBe(25);
  });
});
```
- [ ] **Step 2: Run → FAIL** (`recomputeHero`/`SLOTS` undefined)
- [ ] **Step 3: Rewrite `src/systems/hero.js`**
```js
import { computeDerived } from './stats.js';

export const SLOTS = ['waffe', 'kopf', 'brust', 'beine', 'haende', 'fuesse', 'ring1', 'ring2', 'amulett', 'umhang'];

export const CLASSES = {
  krieger: {
    name: 'Krieger', primary: { str: 12, agi: 6, int: 3, sta: 10 },
    growth: { str: 2, agi: 1, int: 0, sta: 2 },
    weapon: { name: 'Abgenutztes Schwert', dmg: 10 },
    abilities: ['heroic_strike', 'whirlwind', 'shield_block', 'execute'],
  },
};

function emptyEquipment() {
  return Object.fromEntries(SLOTS.map((s) => [s, null]));
}

export function createHero(classId) {
  const c = CLASSES[classId];
  if (!c) throw new Error(`Unbekannte Klasse: ${classId}`);
  const hero = {
    id: 'hero', name: c.name, side: 'hero', classId, level: 1,
    xp: 0, pendingDrafts: 0,
    primaryBase: { ...c.primary },
    baseArmor: 30, baseWeaponDmg: c.weapon.dmg,
    equipment: emptyEquipment(), inventory: [],
    talentMods: { str: 0, agi: 0, int: 0, sta: 0, crit: 0, ap: 0, armor: 0, hp: 0 },
    talents: [],
    resource: { type: 'rage', value: 0, max: 100 },
    abilities: [...c.abilities], cooldowns: {},
    autoAttackEvery: 2000, autoAttackTimer: 2000,
    ai: null, telegraph: null, blocking: 0, alive: true,
    maxHp: 0, hp: 0, ap: 0, weaponDmg: 0, critChance: 0, armor: 0,
  };
  recomputeHero(hero);
  hero.hp = hero.maxHp;
  return hero;
}

export function recomputeHero(hero) {
  const ratio = hero.maxHp ? hero.hp / hero.maxHp : 1;
  const p = { ...hero.primaryBase };
  const tm = hero.talentMods;
  p.str += tm.str; p.agi += tm.agi; p.int += tm.int; p.sta += tm.sta;
  let crit = tm.crit, ap = tm.ap, armor = tm.armor, hp = tm.hp;
  let weaponDmg = hero.baseWeaponDmg;
  for (const slot of SLOTS) {
    const it = hero.equipment[slot];
    if (!it) continue;
    const a = it.affixes || {};
    p.str += a.str || 0; p.agi += a.agi || 0; p.int += a.int || 0; p.sta += a.sta || 0;
    crit += a.crit || 0; ap += a.ap || 0; armor += a.armor || 0; hp += a.hp || 0;
    if (slot === 'waffe' && it.weaponDmg) weaponDmg = it.weaponDmg;
  }
  const d = computeDerived(p, hero.level, { dmg: weaponDmg, bonusAp: ap });
  hero.primary = p;
  hero.maxHp = d.maxHp + hp;
  hero.ap = d.ap;
  hero.critChance = d.critChance + crit;
  hero.armor = hero.baseArmor + armor;
  hero.weaponDmg = weaponDmg;
  hero.hp = Math.max(1, Math.round(hero.maxHp * ratio));
  return hero;
}
```
- [ ] **Step 4: Run → PASS** (hero tests + recompute). Then run full suite — Plan-2 combat tests must still pass (hero still exposes maxHp/ap/weaponDmg/critChance/armor).
- [ ] **Step 5: Commit** `refactor(hero): recompute derived stats from base+gear+talents`

---

## Task 2: Leveling (`src/systems/leveling.js`)

**Files:** Create `src/systems/leveling.js`, Test `tests/systems/leveling.test.js`

- [ ] **Step 1: Write the failing test**
```js
import { describe, it, expect } from 'vitest';
import { createHero } from '../../src/systems/hero.js';
import { xpForLevel, addXp, LEVEL_CAP } from '../../src/systems/leveling.js';

describe('leveling', () => {
  it('xpForLevel grows with level', () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(4)).toBeGreaterThan(xpForLevel(2));
  });
  it('addXp below threshold does not level', () => {
    const h = createHero('krieger');
    expect(addXp(h, 50)).toBe(0);
    expect(h.level).toBe(1);
  });
  it('leveling up raises stats, heals fully and queues a draft', () => {
    const h = createHero('krieger');
    const ap0 = h.ap, hp0 = h.maxHp;
    h.hp = 1;
    const gained = addXp(h, xpForLevel(1));
    expect(gained).toBe(1);
    expect(h.level).toBe(2);
    expect(h.ap).toBeGreaterThan(ap0);     // STR growth -> AP
    expect(h.maxHp).toBeGreaterThan(hp0);  // STA growth -> HP
    expect(h.hp).toBe(h.maxHp);            // full heal
    expect(h.pendingDrafts).toBe(1);
  });
  it('never exceeds the level cap', () => {
    const h = createHero('krieger');
    addXp(h, 10_000_000);
    expect(h.level).toBe(LEVEL_CAP);
  });
});
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement**
```js
import { recomputeHero, CLASSES } from './hero.js';

export const LEVEL_CAP = 10;
export const xpForLevel = (level) => Math.round(100 * Math.pow(level, 1.5));

export function addXp(hero, amount) {
  hero.xp += amount;
  let leveled = 0;
  while (hero.level < LEVEL_CAP && hero.xp >= xpForLevel(hero.level)) {
    hero.xp -= xpForLevel(hero.level);
    hero.level += 1;
    leveled += 1;
    const g = CLASSES[hero.classId].growth;
    hero.primaryBase.str += g.str; hero.primaryBase.agi += g.agi;
    hero.primaryBase.int += g.int; hero.primaryBase.sta += g.sta;
    hero.pendingDrafts += 1;
  }
  if (leveled) { recomputeHero(hero); hero.hp = hero.maxHp; }
  return leveled;
}
```
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** `feat(progression): XP curve + leveling with stat growth`

---

## Task 3: Talents + draft (`src/data/talents.js`, `src/systems/talentDraft.js`)

**Files:** Create both + `tests/systems/talentDraft.test.js`

- [ ] **Step 1: Write the failing test**
```js
import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/core/rng.js';
import { createHero } from '../../src/systems/hero.js';
import { draftTalents, applyTalent } from '../../src/systems/talentDraft.js';

describe('talent draft', () => {
  it('drafts n distinct talents, deterministically per seed', () => {
    const a = draftTalents(makeRng(5), 3).map((t) => t.id);
    const b = draftTalents(makeRng(5), 3).map((t) => t.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(3);
  });
  it('applying a talent raises the relevant stat and consumes a pending draft', () => {
    const h = createHero('krieger');
    h.pendingDrafts = 1;
    const ap0 = h.ap;
    expect(applyTalent(h, 'kraftvoll')).toBe(true); // +4 STR
    expect(h.ap).toBe(ap0 + 8); // +4 STR -> +8 AP
    expect(h.pendingDrafts).toBe(0);
    expect(h.talents).toContain('kraftvoll');
  });
});
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement `src/data/talents.js`**
```js
export const TALENTS = {
  kraftvoll:  { id: 'kraftvoll',  name: 'Kraftvoll',  desc: '+4 Stärke',         mods: { str: 4 } },
  flink:      { id: 'flink',      name: 'Flink',      desc: '+3 Beweglichkeit',   mods: { agi: 3 } },
  zaeh:       { id: 'zaeh',       name: 'Zäh',        desc: '+40 max. HP',        mods: { hp: 40 } },
  scharf:     { id: 'scharf',     name: 'Scharf',     desc: '+5% Krit',           mods: { crit: 0.05 } },
  berserker:  { id: 'berserker',  name: 'Berserker',  desc: '+12 Angriffskraft',  mods: { ap: 12 } },
  gepanzert:  { id: 'gepanzert',  name: 'Gepanzert',  desc: '+30 Rüstung',        mods: { armor: 30 } },
};
export const TALENT_IDS = Object.keys(TALENTS);
```
   **and `src/systems/talentDraft.js`**
```js
import { TALENTS, TALENT_IDS } from '../data/talents.js';
import { recomputeHero } from './hero.js';

export function draftTalents(rng, n = 3) {
  const pool = [...TALENT_IDS];
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  }
  return out.map((id) => TALENTS[id]);
}

export function applyTalent(hero, talentId) {
  const t = TALENTS[talentId];
  if (!t) return false;
  for (const k of Object.keys(t.mods)) hero.talentMods[k] = (hero.talentMods[k] || 0) + t.mods[k];
  hero.talents.push(talentId);
  hero.pendingDrafts = Math.max(0, hero.pendingDrafts - 1);
  recomputeHero(hero);
  return true;
}
```
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** `feat(progression): talent pool + draft (pick 1 of 3)`

---

## Task 4: Affixes + loot (`src/data/affixes.js`, `src/systems/loot.js`)

**Files:** Create both + `tests/systems/loot.test.js`, `tests/data/affixes.test.js`

- [ ] **Step 1: Write the failing tests**
```js
// tests/data/affixes.test.js
import { describe, it, expect } from 'vitest';
import { RARITY, AFFIX_POOL, SLOT_NAMES } from '../../src/data/affixes.js';
describe('affix/rarity data', () => {
  it('rarity tiers carry affix counts ascending and a colour', () => {
    expect(RARITY.grau.affixes).toBe(0);
    expect(RARITY.orange.affixes).toBeGreaterThan(RARITY.blau.affixes);
    for (const r of Object.values(RARITY)) expect(typeof r.color).toBe('string');
  });
  it('affix pool entries have a key and per-ilvl value', () => {
    for (const a of AFFIX_POOL) { expect(a.key).toBeTruthy(); expect(a.per).toBeGreaterThan(0); }
  });
});
```
```js
// tests/systems/loot.test.js
import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/core/rng.js';
import { makeEnemy } from '../../src/data/enemies.js';
import { rollLoot } from '../../src/systems/loot.js';
import { RARITY } from '../../src/data/affixes.js';

describe('rollLoot', () => {
  it('is deterministic for a given seed', () => {
    const a = rollLoot(makeEnemy('raeuber'), makeRng(4));
    const b = rollLoot(makeEnemy('raeuber'), makeRng(4));
    expect(a).toEqual(b);
  });
  it('boss always drops with elevated rarity and matching affix count', () => {
    const drop = rollLoot(makeEnemy('krell'), makeRng(2));
    expect(drop).not.toBeNull();
    expect(drop.affixes && typeof drop.affixes).toBe('object');
    expect(Object.keys(drop.affixes).length).toBe(RARITY[drop.rarity].affixes);
  });
  it('weapon drops carry a weaponDmg, others do not', () => {
    // scan a few seeds to find one weapon + one non-weapon
    let wpn = null, other = null;
    for (let s = 0; s < 60 && (!wpn || !other); s++) {
      const it = rollLoot(makeEnemy('krell'), makeRng(s));
      if (!it) continue;
      if (it.slot === 'waffe') wpn = it; else other = it;
    }
    if (wpn) expect(wpn.weaponDmg).toBeGreaterThan(0);
    if (other) expect(other.weaponDmg).toBeUndefined();
  });
});
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement `src/data/affixes.js`**
```js
export const RARITY = {
  grau:   { key: 'grau',   affixes: 0, weight: 18, color: '#9d9d9d', label: 'Schrott' },
  weiss:  { key: 'weiss',  affixes: 0, weight: 30, color: '#ffffff', label: 'Gewöhnlich' },
  gruen:  { key: 'gruen',  affixes: 1, weight: 30, color: '#1eba5a', label: 'Ungewöhnlich' },
  blau:   { key: 'blau',   affixes: 2, weight: 15, color: '#3b82f6', label: 'Selten' },
  lila:   { key: 'lila',   affixes: 3, weight: 6,  color: '#a335ee', label: 'Episch' },
  orange: { key: 'orange', affixes: 4, weight: 1,  color: '#ff8000', label: 'Legendär' },
};
export const RARITY_ORDER = ['grau', 'weiss', 'gruen', 'blau', 'lila', 'orange'];

// per = stat value per item level
export const AFFIX_POOL = [
  { key: 'str',   name: 'der Stärke',        per: 1.0 },
  { key: 'agi',   name: 'der Gewandtheit',   per: 1.0 },
  { key: 'sta',   name: 'der Ausdauer',      per: 1.2 },
  { key: 'ap',    name: 'der Wucht',         per: 1.0 },
  { key: 'crit',  name: 'des Schlächters',   per: 0.004 },
  { key: 'armor', name: 'des Schutzes',      per: 2.0 },
];

export const SLOT_NAMES = {
  waffe: 'Schwert', kopf: 'Helm', brust: 'Brustplatte', beine: 'Beinschienen',
  haende: 'Handschuhe', fuesse: 'Stiefel', ring1: 'Ring', ring2: 'Ring',
  amulett: 'Amulett', umhang: 'Umhang',
};
export const LOOT_SLOTS = Object.keys(SLOT_NAMES);
```
   **and `src/systems/loot.js`**
```js
import { RARITY, RARITY_ORDER, AFFIX_POOL, SLOT_NAMES, LOOT_SLOTS } from '../data/affixes.js';

let SEQ = 0; // local id counter (ids need not be globally stable)

function bumpRarity(key, steps) {
  const i = Math.min(RARITY_ORDER.length - 1, RARITY_ORDER.indexOf(key) + steps);
  return RARITY_ORDER[i];
}

export function rollLoot(enemy, rng) {
  const dropChance = enemy.boss || enemy.elite ? 1 : 0.6;
  if (!rng.chance(dropChance)) return null;

  let rarity = rng.weighted(Object.values(RARITY).map((r) => ({ item: r.key, weight: r.weight })));
  if (enemy.boss) rarity = bumpRarity(rarity, 2);
  else if (enemy.elite) rarity = bumpRarity(rarity, 1);

  const ilvl = enemy.level + rng.int(0, 2);
  const slot = rng.pick(LOOT_SLOTS);
  const count = RARITY[rarity].affixes;

  const pool = [...AFFIX_POOL];
  const affixes = {};
  let suffix = '';
  for (let i = 0; i < count && pool.length; i++) {
    const a = pool.splice(rng.int(0, pool.length - 1), 1)[0];
    const val = a.key === 'crit' ? +(a.per * ilvl).toFixed(3) : Math.max(1, Math.round(a.per * ilvl));
    affixes[a.key] = (affixes[a.key] || 0) + val;
    if (!suffix) suffix = ' ' + a.name;
  }
  const item = {
    id: `it_${++SEQ}`,
    slot,
    rarity,
    ilvl,
    affixes,
    name: `${SLOT_NAMES[slot]}${suffix}`,
  };
  if (slot === 'waffe') item.weaponDmg = 6 + ilvl * 2;
  return item;
}
```
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** `feat(loot): rarity-weighted item drops with ilvl-scaled affixes`

---

## Task 5: Equipment (`src/systems/equipment.js`)

**Files:** Create `src/systems/equipment.js`, Test `tests/systems/equipment.test.js`

- [ ] **Step 1: Write the failing test**
```js
import { describe, it, expect } from 'vitest';
import { createHero } from '../../src/systems/hero.js';
import { equipItem } from '../../src/systems/equipment.js';

const item = (slot, affixes, extra = {}) => ({ id: 'i' + Math.random(), slot, rarity: 'gruen', ilvl: 4, affixes, ...extra });

describe('equipItem', () => {
  it('equips into its slot, recomputes stats, returns null when slot was empty', () => {
    const h = createHero('krieger');
    const ap0 = h.ap;
    const prev = equipItem(h, item('brust', { str: 6 }));
    expect(prev).toBeNull();
    expect(h.equipment.brust).toBeTruthy();
    expect(h.ap).toBe(ap0 + 12); // +6 STR
  });
  it('swapping returns the previously equipped item to inventory', () => {
    const h = createHero('krieger');
    const a = item('brust', { str: 6 });
    const b = item('brust', { str: 10 });
    equipItem(h, a);
    const prev = equipItem(h, b);
    expect(prev).toBe(a);
    expect(h.inventory).toContain(a);
    expect(h.equipment.brust).toBe(b);
  });
  it('removes the equipped item from inventory if it was there', () => {
    const h = createHero('krieger');
    const a = item('kopf', { sta: 5 });
    h.inventory.push(a);
    equipItem(h, a);
    expect(h.inventory).not.toContain(a);
  });
});
```
- [ ] **Step 2: Run → FAIL**
- [ ] **Step 3: Implement**
```js
import { recomputeHero } from './hero.js';

export function equipItem(hero, item) {
  const slot = item.slot;
  const prev = hero.equipment[slot] || null;
  const idx = hero.inventory.indexOf(item);
  if (idx >= 0) hero.inventory.splice(idx, 1);
  hero.equipment[slot] = item;
  if (prev) hero.inventory.push(prev);
  recomputeHero(hero);
  return prev;
}
```
- [ ] **Step 4: Run → PASS**
- [ ] **Step 5: Commit** `feat(equip): equip/swap items with stat recompute`

---

## Task 6: Character screen UI (`src/ui/characterScreen.js`) — behaviour + live verify

`mountCharacterScreen(root, hero, { onClose })`:
- Shows the hero header: name, **Level**, XP toward next, and core stats (HP, AP, Krit %, Rüstung, Waffenschaden).
- **Equipment** grid: each slot shows the equipped item name in its rarity colour, or "—".
- **Inventory** list: each item as a row `[Name in rarity colour] [ilvl] [affix summary]` with an **Anlegen** button. Tapping equips it (via `equipItem`), then re-renders (so stat changes + slot fill are visible). Equipping shows a green/red delta hint next to the changed core stats is optional; minimum: the stat panel re-renders with new values.
- A **Schließen** button calls `onClose()`.
- Pure rendering from `hero`; no game logic beyond calling `equipItem`.

- [ ] **Step 1:** Implement `characterScreen.js` + CSS for `.char`, `.equip-grid`, `.inv-row`, `.rarity-*` colours (drive colour from `RARITY[item.rarity].color`).
- [ ] **Step 2: Live verify** — temporary: from `main.js` create a hero, push a few `rollLoot` items into `hero.inventory`, mount the character screen. `preview_start`; screenshot shows equipment slots + inventory rows in rarity colours; `preview_eval` taps an "Anlegen" button and confirms `window.__hero.equipment[slot]` filled and a core stat increased; `preview_console_logs level error` empty.
- [ ] **Step 3: Commit** `feat(ui): character + inventory screen with equip`

---

## Task 7: Integrate rewards into the run + verify + tag

**Files:** Modify `src/run.js`, `src/main.js`

`run.js`: add `lootRng = makeRng(seed)` and `grantRewards(enemies)` returning `{ xp, leveled, drops }`:
```js
import { makeRng } from './core/rng.js';
import { addXp } from './systems/leveling.js';
import { rollLoot } from './systems/loot.js';
// in createRun: const lootRng = makeRng(7777);
grantRewards(enemies) {
  const xp = enemies.reduce((s, e) => s + (e.xp || 0), 0);
  const leveled = addXp(hero, xp);
  const drops = enemies.map((e) => rollLoot(e, lootRng)).filter(Boolean);
  hero.inventory.push(...drops);
  return { xp, leveled, drops };
}
```

`main.js` flow changes:
- On combat win, before advancing: `const rewards = run.grantRewards(sim.state.enemies)` (read enemies from the just-ended sim — capture it in `playEncounter`).
- The **interstitial** now shows: XP gained, "Stufe X erreicht!" if `rewards.leveled`, the drops (names in rarity colour), plus buttons: **Held** (opens `mountCharacterScreen`, with a talent-draft section if `hero.pendingDrafts>0`) and **Weiter**.
- **Talent draft**: if `hero.pendingDrafts > 0`, the character screen (or a dedicated overlay) shows `draftTalents(hero-scoped rng)` as 3 buttons; picking calls `applyTalent` and re-renders. Block "Weiter" only if you want to force a pick — keep it optional (pending persists to next level).
- After equipping/drafting, **Weiter** → next encounter with the now-stronger hero.

- [ ] **Step 1:** Implement `run.grantRewards` + wire rewards/character/draft into `main.js` interstitial.
- [ ] **Step 2: Live verify the loop** — `preview_start`; start a run; auto-resolve encounter 1; on the interstitial confirm XP + any drop shown; open **Held**, equip an item (stat rises), pick a talent if offered; **Weiter**; confirm the hero carries the stronger stats into encounter 2. Drive deeper (fast-forward fights via `window.__combat.step(60000)`) to confirm the hero, levelled + geared, can now beat the **elite** and ideally **Krell** → "Eichhain bezwungen!". No console errors.
- [ ] **Step 3: Run full suite** `npm test` (all Plan 1–3 tests green).
- [ ] **Step 4: Commit** `feat: progression+loot integrated — hero levels, loots, equips, can clear Zone 1` and **tag** `git tag v1-m3-progression`.

---

## Definition of Done (Plan 3)
- `npm test` green incl. hero/leveling/talentDraft/loot/equipment.
- In the browser: kills grant XP; level-ups raise stats + offer a talent; enemies drop rarity-coloured items; the character screen equips gear and the hero's stats rise; a levelled, geared hero can clear Zone 1 → "Eichhain bezwungen!".
- Combat (Plan 2) still passes unchanged.

## Self-Review
- **Spec coverage:** leveling/level cap (§3,§14) → T2; talent draft (§12) → T3; loot/rarity/affixes/sets-minus-sets (§8) → T4; slots+equip+stat recompute (§8,§3) → T1,T5; inventory/character UI (§15) → T6; reward integration (§8,§14) → T7. Sets & sockets deferred to post-v1 (spec §19) — noted.
- **Placeholder scan:** none; UI tasks list exact behaviours + concrete verification.
- **Type consistency:** item shape, `recomputeHero`, `SLOTS`, `equipItem`, `addXp`, `rollLoot`, `RARITY`, `applyTalent`/`draftTalents` names match across tasks & tests. Hero top-level combat fields (maxHp/ap/weaponDmg/critChance/armor) preserved for Plan-2 combat.

*End of Plan 3. On completion → Plan 4 (Berufe & Minigames).*
