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
  it('returns false for an unknown talent', () => {
    expect(applyTalent(createHero('krieger'), 'nope')).toBe(false);
  });
});
