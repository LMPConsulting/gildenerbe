import { makeRng } from '../core/rng.js';
import { rollLoot } from './loot.js';
import { makeEnemy } from '../data/enemies.js';

// Scout missions: send a scout out for real time; they return with loot.
// (Player ask: "jemanden auf eine Mission schicken, der kommt mit Sachen wieder")

export const MISSIONS = {
  kundschaft: {
    id: 'kundschaft', name: 'Kundschaft im Eichhain', durationMin: 10,
    cost: { erbe: 5 }, desc: 'Schnell: etwas Erz & Kupfer.',
  },
  jagdzug: {
    id: 'jagdzug', name: 'Jagdzug', durationMin: 45,
    cost: { erbe: 15 }, desc: 'Mittel: Materialien & Chance auf Ausrüstung.',
  },
  expedition: {
    id: 'expedition', name: 'Expedition zur Stollentiefe', durationMin: 180,
    cost: { erbe: 40 }, desc: 'Lang: viel Erbe, gute Beutechance.',
  },
};
export const MISSION_IDS = Object.keys(MISSIONS);

// Start a mission if none active and affordable. Returns true on success.
export function startMission(account, missionId, nowMs) {
  if (account.missions.active) return false;
  const m = MISSIONS[missionId];
  if (!m) return false;
  if ((m.cost.erbe || 0) > account.meta.erbe) return false;
  account.meta.erbe -= m.cost.erbe || 0;
  account.missions.active = {
    id: missionId,
    startedAt: nowMs,
    durationMs: m.durationMin * 60_000,
    seed: (nowMs % 100000) + 7,
  };
  return true;
}

export function missionRemainingMs(account, nowMs) {
  const a = account.missions.active;
  if (!a) return null;
  return Math.max(0, a.startedAt + a.durationMs - nowMs);
}

// If the active mission is done, resolve it: returns rewards or null.
// Rewards: { erbe, mats: {key:n}, item|null }
export function resolveMissionIfDone(account, nowMs) {
  const a = account.missions.active;
  if (!a || missionRemainingMs(account, nowMs) > 0) return null;
  const rng = makeRng(a.seed);
  const tier = a.id === 'expedition' ? 3 : a.id === 'jagdzug' ? 2 : 1;
  const rewards = {
    missionId: a.id,
    erbe: tier * 8 + rng.int(0, tier * 6),
    mats: {
      kupfererz: rng.int(tier, tier * 3),
      kraeuter: rng.int(0, tier * 2),
      ...(tier >= 2 ? { eisenerz: rng.int(1, tier * 2) } : {}),
    },
    item: null,
  };
  if (rng.chance(tier >= 3 ? 0.8 : tier === 2 ? 0.45 : 0.15)) {
    rewards.item = rollLoot(makeEnemy(tier >= 3 ? 'rudelfuehrer' : 'raeuber'), rng);
  }
  account.meta.erbe += rewards.erbe;
  account.missions.active = null;
  return rewards;
}
