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
    expect(h.ap).toBeGreaterThan(ap0);
    expect(h.maxHp).toBeGreaterThan(hp0);
    expect(h.hp).toBe(h.maxHp);
    expect(h.pendingDrafts).toBe(1);
  });
  it('never exceeds the level cap', () => {
    const h = createHero('krieger');
    addXp(h, 10_000_000);
    expect(h.level).toBe(LEVEL_CAP);
  });
});
