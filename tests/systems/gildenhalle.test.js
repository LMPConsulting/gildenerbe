import { describe, it, expect } from 'vitest';
import { createHero } from '../../src/systems/hero.js';
import { buildingCost, buyBuilding, buildingLevel, applyMetaToHero } from '../../src/systems/gildenhalle.js';

const meta = (erbe = 0, buildings = {}) => ({ erbe, buildings });

describe('gildenhalle buildings', () => {
  it('cost rises with level', () => {
    expect(buildingCost('trainingshalle', 1)).toBeGreaterThan(buildingCost('trainingshalle', 0));
  });
  it('buyBuilding spends Erbe and raises the level when affordable', () => {
    const m = meta(1000);
    const cost = buildingCost('trainingshalle', 0);
    expect(buyBuilding(m, 'trainingshalle')).toBe(true);
    expect(buildingLevel(m, 'trainingshalle')).toBe(1);
    expect(m.erbe).toBe(1000 - cost);
  });
  it('refuses when Erbe is insufficient (no change)', () => {
    const m = meta(1);
    expect(buyBuilding(m, 'trainingshalle')).toBe(false);
    expect(buildingLevel(m, 'trainingshalle')).toBe(0);
    expect(m.erbe).toBe(1);
  });
});

describe('applyMetaToHero', () => {
  it('a hero from a built-up Gildenhalle is stronger than a fresh one', () => {
    const base = createHero('krieger');
    const buffed = createHero('krieger');
    applyMetaToHero(buffed, meta(0, { trainingshalle: 3, heldengruft: 2, waffenkammer: 1 }));
    expect(buffed.maxHp).toBeGreaterThan(base.maxHp);
    expect(buffed.ap).toBeGreaterThan(base.ap);
    expect(buffed.inventory.length).toBe(1); // Waffenkammer starter weapon
  });
});
