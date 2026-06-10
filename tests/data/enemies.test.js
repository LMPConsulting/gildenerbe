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
