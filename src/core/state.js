import { makeBag } from '../systems/materials.js';

export const GAME_VERSION = 3;

// The full account/save shape. `run` is null when no hero is active.
export function createInitialState() {
  return {
    version: GAME_VERSION,
    createdAt: 0,
    lastSaved: 0,
    settings: { musicVolume: 0.6, sfxVolume: 0.8 },
    tutorialSeen: false,
    meta: {
      erbe: 0,
      buildings: {},
      unlockedClasses: ['krieger', 'schurke', 'magier'], // all three playable from the start
      knownRecipes: [],
      reputation: {},
    },
    // v3 hub economy (persists across hero lives; wiped only when the base falls)
    gold: 0,
    materials: makeBag(),       // banked run materials -> crafting/enchanting
    rods: [],                   // fishing rods (durability)
    equippedRodId: null,
    fishpond: [],               // caught fish -> cooking
    larder: [],                 // cooked food -> eaten before a run
    pendingFood: null,          // { stat, value, label, runsLeft } applied at hero start
    chest: [],                  // shared guild chest (off-class gear); dies with the base

    base: { hp: 100, maxHp: 100, wallLevel: 0, runsSinceAttack: 0, underAttack: false, generation: 1 },
    chronik: { punkte: 0, upgrades: { baumeister: 0, gruendung: 0, schutz: 0 } },
    missions: { active: null },
    run: null,
    stats: { totalRuns: 0, bestZone: 0, playTicks: 0, basesLost: 0, raidsWon: 0 },
  };
}
