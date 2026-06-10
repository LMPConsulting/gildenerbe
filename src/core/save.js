export const SAVE_KEY = 'gildenerbe.save';
export const SAVE_VERSION = 2;

// migrations[n] upgrades a state saved at version n to version n+1.
const migrations = {
  // v1 (initial release) -> v2: base raids, Chronik meta-meta, missions, tutorial flag.
  1: (state) => ({
    ...state,
    tutorialSeen: state.tutorialSeen ?? true, // existing players skip the tutorial
    base: state.base ?? {
      hp: 100, maxHp: 100, wallLevel: 0,
      runsSinceAttack: 0, underAttack: false, generation: 1,
    },
    chronik: state.chronik ?? { punkte: 0, upgrades: { baumeister: 0, gruendung: 0, schutz: 0 } },
    missions: state.missions ?? { active: null },
    stats: { basesLost: 0, raidsWon: 0, ...(state.stats || {}) },
  }),
};

export function saveGame(storage, state) {
  storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state }));
}

export function loadGame(storage) {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  let { version, state } = data;
  if (state === undefined) return null;
  while (version < SAVE_VERSION && migrations[version]) {
    state = migrations[version](state);
    version++;
  }
  return state;
}

export function clearSave(storage) {
  storage.removeItem(SAVE_KEY);
}
