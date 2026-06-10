import { SLOTS } from './hero.js';

// Erbe (Legacy) earned when a hero falls or retires. Scales with level, gear
// quality, encounters cleared, and the Schatzkammer bonus (spec §11).
export function computeErbe(hero, encountersCleared, meta) {
  const equipped = SLOTS.map((s) => hero.equipment[s]).filter(Boolean);
  const avgIlvl = equipped.length ? equipped.reduce((s, i) => s + (i.ilvl || 0), 0) / equipped.length : 0;
  const base = Math.pow(hero.level, 1.5) * (1 + avgIlvl / 100) * (1 + encountersCleared * 0.12);
  const treasuryPct = ((meta && meta.buildings && meta.buildings.schatzkammer) || 0) * 0.15;
  return Math.max(1, Math.round(base * (1 + treasuryPct)));
}

// Offline yield: a small passive Erbe trickle from the Schatzkammer while away.
// secs is the (already capped) elapsed seconds; returns whole Erbe.
export function offlineErbe(meta, secs) {
  const lvl = (meta && meta.buildings && meta.buildings.schatzkammer) || 0;
  if (lvl <= 0) return 0;
  return Math.floor((lvl * secs) / 60); // lvl Erbe per minute
}

// Offline cap grows with the Schatzkammer: 8h base, +4h per level.
export function offlineCapSeconds(meta) {
  const lvl = (meta && meta.buildings && meta.buildings.schatzkammer) || 0;
  return (8 + lvl * 4) * 3600;
}
