import { describe, it, expect } from 'vitest';
import { createMemoryStorage, createWebStorage } from '../../src/core/storage.js';

describe('createMemoryStorage', () => {
  it('round-trips set/get and returns null for missing keys', () => {
    const s = createMemoryStorage();
    expect(s.getItem('k')).toBeNull();
    s.setItem('k', 'v');
    expect(s.getItem('k')).toBe('v');
  });

  it('removeItem deletes the key', () => {
    const s = createMemoryStorage();
    s.setItem('k', 'v');
    s.removeItem('k');
    expect(s.getItem('k')).toBeNull();
  });
});

describe('createWebStorage', () => {
  it('delegates to the provided backend and coerces values to string', () => {
    const calls = [];
    const backend = {
      getItem: (k) => { calls.push(['get', k]); return 'X'; },
      setItem: (k, v) => calls.push(['set', k, v]),
      removeItem: (k) => calls.push(['rm', k]),
    };
    const s = createWebStorage(backend);
    s.setItem('a', 1);              // number coerced to '1'
    expect(s.getItem('a')).toBe('X');
    s.removeItem('a');
    expect(calls).toEqual([['set', 'a', '1'], ['get', 'a'], ['rm', 'a']]);
  });
});
