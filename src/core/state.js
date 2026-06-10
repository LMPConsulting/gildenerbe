export const GAME_VERSION = 2;

// The full account/save shape. `run` is null when no hero is active.
export function createInitialState() {
  return {
    version: GAME_VERSION,
    createdAt: 0,        // set by boot layer (Date.now)
    lastSaved: 0,        // set on save
    settings: { musicVolume: 0.6, sfxVolume: 0.8 },
    tutorialSeen: false,
    meta: {
      erbe: 0,
      buildings: {},          // { buildingId: level }
      unlockedClasses: ['krieger'],
      knownRecipes: [],
      reputation: {},         // { factionId: points }
    },
    // v2: the base itself can be hurt by raids and ultimately fall.
    base: {
      hp: 100, maxHp: 100,
      wallLevel: 0,
      runsSinceAttack: 0,
      underAttack: false,
      generation: 1,          // how many bases this account has built
    },
    // v2: meta-meta layer — survives base destruction.
    chronik: {
      punkte: 0,
      upgrades: { baumeister: 0, gruendung: 0, schutz: 0 },
    },
    // v2: real-time scout missions.
    missions: { active: null }, // { id, startedAt, durationMs, seed }
    run: null,
    stats: { totalRuns: 0, bestZone: 0, playTicks: 0, basesLost: 0, raidsWon: 0 },
  };
}
