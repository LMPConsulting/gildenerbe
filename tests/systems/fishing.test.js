import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/core/rng.js';
import { makeBag, addMat } from '../../src/systems/materials.js';
import { ROD_TIERS, ROD_ORDER, makeRod } from '../../src/data/rods.js';
import {
  CAST_COST, FISH_SPECIES, canFish, equippedRod, equipRod,
  createCast, resolveCast, craftRod, rollFish,
} from '../../src/systems/fishing.js';

function makeAccount(over = {}) {
  return {
    gold: 100,
    materials: makeBag(),
    rods: [],
    equippedRodId: null,
    fishpond: [],
    larder: [],
    pendingFood: null,
    ...over,
  };
}

// Drives a cast to its bite window and lands the fish.
function catchFish(account, seed) {
  const cast = createCast(makeRng(seed), equippedRod(account));
  cast.step(cast.biteDelayMs);
  expect(cast.state).toBe('window');
  const fish = cast.tap();
  expect(cast.state).toBe('caught');
  return { cast, fish };
}

describe('rod data', () => {
  it('defines 4 tiers with rising durability, luck and cost', () => {
    expect(ROD_ORDER).toHaveLength(4);
    let prev = null;
    for (const id of ROD_ORDER) {
      const t = ROD_TIERS[id];
      expect(t.maxDurability).toBeGreaterThan(0);
      if (prev) {
        expect(t.maxDurability).toBeGreaterThan(prev.maxDurability);
        expect(t.luck).toBeGreaterThan(prev.luck);
        expect(t.craftCost.gold).toBeGreaterThan(prev.craftCost.gold);
      }
      prev = t;
    }
  });
  it('makeRod builds a full-durability instance and rejects unknown tiers', () => {
    const rod = makeRod('eiche');
    expect(rod.durability).toBe(ROD_TIERS.eiche.maxDurability);
    expect(rod.maxDurability).toBe(15);
    expect(rod.luck).toBe(1);
    expect(rod.name).toBe('Eichenrute');
    expect(makeRod('nope')).toBeNull();
  });
});

describe('craftRod', () => {
  it('spends gold + materials and adds an equipped rod', () => {
    const a = makeAccount({ gold: 50 });
    addMat(a.materials, 'kraeuter', 3);
    expect(craftRod(a, 'weide')).toBe(true);
    expect(a.gold).toBe(40);
    expect(a.materials.kraeuter).toBe(1);
    expect(a.rods).toHaveLength(1);
    expect(a.rods[0].tier).toBe(1);
    expect(a.rods[0].durability).toBe(8);
    expect(a.equippedRodId).toBe(a.rods[0].id);
    expect(equippedRod(a)).toBe(a.rods[0]);
  });
  it('fails without gold or without materials, changing nothing', () => {
    const broke = makeAccount({ gold: 5 });
    addMat(broke.materials, 'kraeuter', 10);
    expect(craftRod(broke, 'weide')).toBe(false);
    expect(broke.gold).toBe(5);
    expect(broke.materials.kraeuter).toBe(10);
    expect(broke.rods).toHaveLength(0);

    const noMats = makeAccount({ gold: 500 });
    expect(craftRod(noMats, 'weide')).toBe(false);
    expect(noMats.gold).toBe(500);
    expect(noMats.rods).toHaveLength(0);

    expect(craftRod(makeAccount(), 'unbekannt')).toBe(false);
  });
  it('crafting a second rod keeps the first one equipped', () => {
    const a = makeAccount({ gold: 500 });
    addMat(a.materials, 'kraeuter', 10);
    addMat(a.materials, 'kupferbarren', 2);
    craftRod(a, 'weide');
    const firstId = a.equippedRodId;
    craftRod(a, 'eiche');
    expect(a.rods).toHaveLength(2);
    expect(a.equippedRodId).toBe(firstId);
    expect(equipRod(a, a.rods[1].id)).toBe(true);
    expect(equippedRod(a).tier).toBe(2);
  });
});

describe('canFish', () => {
  it('is false without a rod, false without gold, true with both', () => {
    const a = makeAccount({ gold: 100 });
    expect(canFish(a)).toBe(false); // keine Rute
    a.rods.push(makeRod('weide'));
    expect(canFish(a)).toBe(true);
    a.gold = CAST_COST - 1;
    expect(canFish(a)).toBe(false); // zu wenig Gold
    a.gold = CAST_COST;
    expect(canFish(a)).toBe(true);
    a.rods[0].durability = 0;
    expect(canFish(a)).toBe(false); // nur kaputte Ruten
  });
});

describe('cast + resolveCast', () => {
  it('a tap inside the window catches a fish; resolve banks it, pays gold, wears the rod', () => {
    const a = makeAccount({ gold: 100, rods: [makeRod('weide')] });
    const { cast, fish } = catchFish(a, 7);
    expect(fish.quality).toBeGreaterThanOrEqual(1);
    expect(fish.quality).toBeLessThanOrEqual(5);
    const res = resolveCast(a, cast, makeRng(99));
    expect(res.fish).toBe(fish);
    expect(res.rodBroke).toBe(false);
    expect(a.fishpond).toHaveLength(1);
    expect(a.fishpond[0]).toMatchObject({ id: fish.id, quality: fish.quality, value: fish.value });
    expect(a.gold).toBe(100 - CAST_COST);
    expect(a.rods[0].durability).toBe(7);
  });
  it('resolving the last durability point removes the rod and reports rodBroke', () => {
    const rod = makeRod('weide');
    rod.durability = 1;
    const a = makeAccount({ gold: 50, rods: [rod], equippedRodId: rod.id });
    const { cast } = catchFish(a, 3);
    const res = resolveCast(a, cast, makeRng(3));
    expect(res.rodBroke).toBe(true);
    expect(a.rods).toHaveLength(0);
    expect(a.equippedRodId).toBeNull();
    expect(canFish(a)).toBe(false);
    expect(a.fishpond).toHaveLength(1); // der letzte Fang bleibt
  });
  it('a failed cast still costs gold + durability but yields no fish', () => {
    const a = makeAccount({ gold: 30, rods: [makeRod('weide')] });
    const cast = createCast(makeRng(5), equippedRod(a));
    cast.step(10);
    expect(cast.tap()).toBeNull(); // zu früh
    expect(cast.state).toBe('failed');
    const res = resolveCast(a, cast, makeRng(5));
    expect(res.fish).toBeNull();
    expect(a.gold).toBe(30 - CAST_COST);
    expect(a.rods[0].durability).toBe(7);
    expect(a.fishpond).toHaveLength(0);
  });
  it('letting the window expire fails the cast; resolve is a one-shot', () => {
    const a = makeAccount({ gold: 30, rods: [makeRod('weide')] });
    const cast = createCast(makeRng(5), equippedRod(a));
    cast.step(cast.biteDelayMs + cast.windowMs + 1);
    expect(cast.state).toBe('failed');
    resolveCast(a, cast, makeRng(5));
    resolveCast(a, cast, makeRng(5)); // doppelt aufgelöst -> no-op
    expect(a.gold).toBe(30 - CAST_COST);
    expect(a.rods[0].durability).toBe(7);
  });
  it('an unfinished cast resolves to nothing and charges nothing', () => {
    const a = makeAccount({ gold: 30, rods: [makeRod('weide')] });
    const cast = createCast(makeRng(5), equippedRod(a));
    const res = resolveCast(a, cast, makeRng(5));
    expect(res).toEqual({ fish: null, rodBroke: false });
    expect(a.gold).toBe(30);
  });
});

describe('determinism + luck', () => {
  it('same seed + same rod -> same fish', () => {
    const a1 = makeAccount({ rods: [makeRod('mithril')] });
    const a2 = makeAccount({ rods: [makeRod('mithril')] });
    const f1 = catchFish(a1, 1234).fish;
    const f2 = catchFish(a2, 1234).fish;
    expect(f1).toEqual(f2);
  });
  it('higher luck never lowers and overall raises fish quality (fixed seeds)', () => {
    let low = 0, high = 0;
    for (let seed = 1; seed <= 300; seed++) {
      low += rollFish(makeRng(seed), 0).quality;
      high += rollFish(makeRng(seed), ROD_TIERS.drache.luck).quality;
    }
    expect(high).toBeGreaterThan(low);
  });
  it('species table covers qualities 1..5', () => {
    expect([...FISH_SPECIES].map((f) => f.quality).sort().join('')).toBe('12345');
  });
});
