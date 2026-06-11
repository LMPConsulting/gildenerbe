import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/core/rng.js';
import { makeBag, addMat } from '../../src/systems/materials.js';
import { RECIPES, RECIPE_ORDER, buffValue, buffLabel } from '../../src/data/foods.js';
import { cookableRecipes, canCook, cook, eat } from '../../src/systems/cooking.js';

const fish = (quality, value = quality * 5) => ({
  id: `q${quality}`, name: `Fisch Q${quality}`, quality, value,
});

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

describe('recipe data', () => {
  it('every recipe uses a contract stat and sane numbers', () => {
    const stats = ['str', 'agi', 'int', 'sta', 'crit', 'ap'];
    for (const id of RECIPE_ORDER) {
      const r = RECIPES[id];
      expect(stats).toContain(r.stat);
      expect(r.minQuality).toBeGreaterThanOrEqual(1);
      expect(r.minQuality).toBeLessThanOrEqual(5);
      expect(r.fishCount).toBeGreaterThan(0);
      expect(r.servings).toBeGreaterThan(0);
    }
  });
  it('buffValue scales with fish quality, buffLabel formats crit as %', () => {
    const r = RECIPES.fischsuppe;
    expect(buffValue(r, r.minQuality)).toBe(r.base);
    expect(buffValue(r, r.minQuality + 2)).toBe(r.base + 2 * r.perQuality);
    expect(buffLabel('crit', 0.03)).toBe('+3% Krit. Chance');
    expect(buffLabel('str', 6)).toBe('+6 Stärke');
  });
});

describe('cookableRecipes / canCook', () => {
  it('lists only recipes with enough qualifying fish and herbs', () => {
    const a = makeAccount({ fishpond: [fish(1), fish(1)] });
    expect(cookableRecipes(a).map((r) => r.id)).toEqual(['fischsuppe']); // Röstfisch braucht 1 Kraut
    addMat(a.materials, 'kraeuter', 2);
    expect(cookableRecipes(a).map((r) => r.id)).toEqual(['fischsuppe', 'roestfisch']);
    a.fishpond.push(fish(4));
    expect(canCook(a, 'kraeuterfilet')).toBe(true); // Q4 zählt als Q2+
    expect(canCook(a, 'runenmahl')).toBe(false); // braucht 3 Kräuter
    addMat(a.materials, 'kraeuter', 1);
    expect(canCook(a, 'runenmahl')).toBe(true);
  });
});

describe('cook', () => {
  it('consumes fish + herbs and produces a buff scaled by fish quality', () => {
    const a = makeAccount({ fishpond: [fish(1), fish(3)] });
    addMat(a.materials, 'kraeuter', 2);
    const cheap = cook(a, 'roestfisch', makeRng(2)); // verbraucht den schlechtesten Fisch (Q1)
    expect(cheap).toBeTruthy();
    expect(cheap.buff).toEqual({ stat: 'str', value: 3 }); // base 3 + 2*(1-1)
    expect(a.fishpond).toEqual([fish(3)]);
    expect(a.materials.kraeuter).toBe(1);
    expect(a.larder).toHaveLength(1);

    const fine = cook(a, 'roestfisch', makeRng(2)); // jetzt bleibt nur der Q3-Fisch
    expect(fine.buff.value).toBe(3 + 2 * (3 - 1)); // base 3 + perQ 2 * (3-1) = 7
    expect(fine.buff.value).toBeGreaterThan(cheap.buff.value);
    expect(a.fishpond).toHaveLength(0);
    expect(a.materials.kraeuter).toBe(0);
  });
  it('averages quality across multi-fish recipes and keeps better fish for later', () => {
    const a = makeAccount({ fishpond: [fish(5), fish(1), fish(3)] });
    const food = cook(a, 'fischsuppe', makeRng(4)); // nimmt Q1 + Q3, Ø=2
    expect(food.buff).toEqual({ stat: 'sta', value: 4 + 2 * (2 - 1) });
    expect(a.fishpond).toEqual([fish(5)]);
    expect(food.servings).toBeGreaterThanOrEqual(RECIPES.fischsuppe.servings);
  });
  it('cannot cook without ingredients — nothing is consumed', () => {
    const noFish = makeAccount();
    addMat(noFish.materials, 'kraeuter', 9);
    expect(cook(noFish, 'roestfisch', makeRng(1))).toBeNull();
    expect(noFish.materials.kraeuter).toBe(9);

    const noHerbs = makeAccount({ fishpond: [fish(2)] });
    expect(cook(noHerbs, 'roestfisch', makeRng(1))).toBeNull();
    expect(noHerbs.fishpond).toHaveLength(1);

    const lowQuality = makeAccount({ fishpond: [fish(1), fish(2)] });
    addMat(lowQuality.materials, 'kraeuter', 9);
    expect(cook(lowQuality, 'goldbraten', makeRng(1))).toBeNull(); // braucht 2x Q3+
    expect(cook(lowQuality, 'unbekannt', makeRng(1))).toBeNull();
  });
  it('is deterministic: same seed -> same food (incl. perfect bonus servings)', () => {
    const run = (seed) => {
      const a = makeAccount({ fishpond: [fish(4), fish(4)] });
      addMat(a.materials, 'kraeuter', 5);
      const f = cook(a, 'sturmfestmahl', makeRng(seed));
      return { value: f.buff.value, servings: f.servings, perfect: f.perfect };
    };
    expect(run(11)).toEqual(run(11));
    expect(run(42)).toEqual(run(42));
    // einer der festen Seeds 1..60 trifft den 15%-Bonus
    const anyPerfect = Array.from({ length: 60 }, (_, i) => run(i + 1).perfect).some(Boolean);
    expect(anyPerfect).toBe(true);
  });
});

describe('eat', () => {
  it('sets account.pendingFood and decrements servings until the dish is gone', () => {
    const a = makeAccount({ fishpond: [fish(1), fish(1)] });
    const food = cook(a, 'fischsuppe', makeRng(3));
    const servings = food.servings;
    expect(eat(a, food.id)).toBe(true);
    expect(a.pendingFood).toEqual({
      stat: 'sta', value: food.buff.value, label: 'Fischsuppe', runsLeft: 1,
    });
    expect(food.servings).toBe(servings - 1);
    for (let i = 1; i < servings; i++) expect(eat(a, food.id)).toBe(true);
    expect(a.larder).toHaveLength(0); // aufgegessen
    expect(eat(a, food.id)).toBe(false);
  });
  it('a feast buff lasts two runs; eating again overwrites pendingFood', () => {
    const a = makeAccount({ fishpond: [fish(4), fish(4), fish(1)] });
    addMat(a.materials, 'kraeuter', 6);
    const feast = cook(a, 'sturmfestmahl', makeRng(8));
    eat(a, feast.id);
    expect(a.pendingFood.runsLeft).toBe(2);
    const soup = cook(a, 'roestfisch', makeRng(8));
    eat(a, soup.id);
    expect(a.pendingFood.label).toBe('Röstfisch');
    expect(a.pendingFood.runsLeft).toBe(1);
  });
  it('returns false for unknown food ids', () => {
    expect(eat(makeAccount(), 'nix')).toBe(false);
  });
});
