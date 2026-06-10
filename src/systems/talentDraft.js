import { TALENTS, TALENT_IDS } from '../data/talents.js';
import { recomputeHero } from './hero.js';

// Offer n distinct talents (seeded). The roguelite draft per level-up.
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
