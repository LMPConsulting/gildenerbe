export const GAME_VERSION = 1;

// The full account/save shape. `run` is null when no hero is active.
export function createInitialState() {
  return {
    version: GAME_VERSION,
    createdAt: 0,        // set by boot layer (Date.now)
    lastSaved: 0,        // set on save
    settings: { musicVolume: 0.6, sfxVolume: 0.8 },
    meta: {
      erbe: 0,
      buildings: {},          // { buildingId: level }
      unlockedClasses: ['krieger'],
      knownRecipes: [],
      reputation: {},         // { factionId: points }
    },
    run: null,                // active hero run (filled in Plan 2)
    stats: { totalRuns: 0, bestZone: 0, playTicks: 0 },
  };
}
