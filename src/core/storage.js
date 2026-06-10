// Storage interface: { getItem(key)->string|null, setItem(key,val), removeItem(key) }.
// Swap createWebStorage() for a Capacitor Preferences adapter later — game code stays the same.

export function createMemoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

// backend defaults to the browser's localStorage at call time; injectable for tests.
export function createWebStorage(backend = globalThis.localStorage) {
  return {
    getItem: (k) => backend.getItem(k),
    setItem: (k, v) => backend.setItem(k, String(v)),
    removeItem: (k) => backend.removeItem(k),
  };
}
