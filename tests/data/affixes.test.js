import { describe, it, expect } from 'vitest';
import { RARITY, AFFIX_POOL, SLOT_NAMES } from '../../src/data/affixes.js';

describe('affix/rarity data', () => {
  it('rarity tiers carry affix counts and a colour, ascending to orange', () => {
    expect(RARITY.grau.affixes).toBe(0);
    expect(RARITY.orange.affixes).toBeGreaterThan(RARITY.blau.affixes);
    for (const r of Object.values(RARITY)) expect(typeof r.color).toBe('string');
  });
  it('affix pool entries have a key and positive per-ilvl value', () => {
    for (const a of AFFIX_POOL) {
      expect(a.key).toBeTruthy();
      expect(a.per).toBeGreaterThan(0);
    }
  });
  it('every loot slot has a display name', () => {
    expect(SLOT_NAMES.waffe).toBeTruthy();
    expect(Object.keys(SLOT_NAMES).length).toBeGreaterThanOrEqual(10);
  });
});
