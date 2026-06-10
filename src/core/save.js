export const SAVE_KEY = 'gildenerbe.save';
export const SAVE_VERSION = 1;

// migrations[n] upgrades a state saved at version n to version n+1.
const migrations = {
  // 1: (state) => ({ ...state, newField: default }),  // example for the future
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
